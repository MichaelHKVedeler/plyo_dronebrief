import { useEffect, useRef, useState } from 'react'
import { Map as LibreMap, type GeoJSONSource } from 'maplibre-gl'
import ShadeMap from 'mapbox-gl-shadow-simulator'
import { MapPin } from 'lucide-react'
import type { Position } from '@/features/briefs/model/brief'
import type { MapNavigation } from './map-navigation'
import type { MapTool } from './placement'
import { shadowBuildings } from './shadow-buildings'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import type { BriefSession } from '@/features/briefs/state/brief-session'
import { cameraAppearance } from '@/features/briefs/components/camera-appearance'
import { fromShadeView, toShadeView, type MapView } from './map-view'
import { shadeScene } from './shade-scene'
import { shadowTime, timeLabel } from './shadow-time'
import { useDarkMode } from '@/lib/use-dark-mode'
import { mapBrandColor } from './map-colors'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = { session: BriefSession; initialView: MapView; onViewChange: (view: MapView) => void; minutes: number; onMinutesChange: (value: number) => void; onNavigation: (navigation: MapNavigation | null) => void; tool: MapTool; onMapClick: (point: Position) => void; onAim: (point: Position) => void }
export function ShadeMapPanel({ session, initialView, onViewChange, minutes, onMinutesChange, onNavigation, tool, onMapClick, onAim }: Props) {
  const dark = useDarkMode()
  const host = useRef<HTMLDivElement>(null)
  const shade = useRef<ShadeMap | null>(null)
  const latest = useRef({ session, onViewChange, minutes, onNavigation, onMapClick, onAim, dark })
  useEffect(() => { latest.current = { session, onViewChange, minutes, onNavigation, onMapClick, onAim, dark } }, [session, onViewChange, minutes, onNavigation, onMapClick, onAim, dark])
  const startView = useRef(initialView)
  const [map, setMap] = useState<LibreMap | null>(null)
  const [view, setView] = useState(initialView)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const key = import.meta.env.VITE_SHADEMAP_API_KEY?.trim()
  const time = shadowTime(session.brief.project.date, minutes, view.center)
  const timestamp = time.instant.getTime()
  useEffect(() => {
    let live = true
    let instance: LibreMap
    try {
      instance = new LibreMap({ container: host.current!, style: 'https://tiles.openfreemap.org/styles/liberty',
        ...toShadeView(startView.current), minZoom: -1, maxZoom: 23, pitch: 0, bearing: 0,
        dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false,
      })
      instance.touchZoomRotate.disableRotation()
    } catch {
      const frame = requestAnimationFrame(() => setError('This browser could not start the shadow map. Return to Google Maps.'))
      return () => cancelAnimationFrame(frame)
    }
    const sync = () => {
      if (!live) return
      const next = fromShadeView(instance.getCenter(), instance.getZoom())
      setView(next); latest.current.onViewChange(next)
    }
    instance.on('move', sync)
    instance.on('click', (event) => latest.current.onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng }))
    instance.on('mousemove', (event) => latest.current.onAim({ lat: event.lngLat.lat, lng: event.lngLat.lng }))
    const pendingLoads = new Set<() => void>()
    const waitForTiles = () => new Promise<void>((resolve) => {
      const finish = () => { instance.off('idle', finish); pendingLoads.delete(finish); resolve() }
      if (!live || instance.loaded()) { resolve(); return }
      pendingLoads.add(finish)
      instance.once('idle', finish)
    })
    // This SDK reports license failures as rejected promises, not error events.
    const licensingError = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error && event.reason.message.startsWith('Could not load ShadeMap API.')) {
        event.preventDefault()
        if (live) setError('Shadows could not load. Check the ShadeMap key and its allowed domains.')
      }
    }
    window.addEventListener('unhandledrejection', licensingError)
    instance.on('error', () => { if (live) setError('Some map data could not load. Check your connection or return to Google Maps.') })
    instance.on('load', () => {
      if (!live) return
      // Hide base-map labels; brief labels and required attribution stay visible.
      for (const layer of instance.getStyle().layers) if (layer.type === 'symbol') instance.setLayoutProperty(layer.id, 'visibility', 'none')
      instance.addSource('brief-scene', { type: 'geojson', data: shadeScene(latest.current.session.brief, latest.current.session.visibility, startView.current.zoom, latest.current.dark) })
      instance.addLayer({ id: 'brief-fill', type: 'fill', source: 'brief-scene', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } })
      instance.addLayer({ id: 'brief-outline', type: 'line', source: 'brief-scene', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } })
      if (key) {
        try {
          const engine = new ShadeMap({ apiKey: key, date: shadowTime(latest.current.session.brief.project.date, latest.current.minutes, startView.current.center).instant,
            color: '#102038', opacity: 0.6,
            terrainSource: { tileSize: 256, maxZoom: 15,
              getSourceUrl: ({ x, y, z }) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
              getElevation: ({ r, g, b }) => r * 256 + g + b / 256 - 32768,
            },
            getFeatures: async () => {
              await waitForTiles()
              if (!live || instance.getZoom() < 12) return []
              const layer = instance.getStyle().layers.find((item) => 'source-layer' in item && item['source-layer'] === 'building')
              if (!layer || !('source' in layer)) return []
              return shadowBuildings(instance.querySourceFeatures(layer.source, { sourceLayer: 'building' }))
            },
          })
          engine.on('error', () => { if (live) setError('Shadows could not load. Check the ShadeMap key and its allowed domains.') })
          // The SDK supports MapLibre but its published declaration names Mapbox.
          engine.addTo(instance as unknown as Parameters<ShadeMap['addTo']>[0])
          shade.current = engine
        } catch { setError('Shadows could not start. Check the ShadeMap key and reload.') }
      }
      setReady(true)
      setMap(instance)
      const literal = (position: google.maps.LatLng | google.maps.LatLngLiteral) => 'toJSON' in position ? position.toJSON() : position
      latest.current.onNavigation({
        getDiv: () => instance.getContainer(),
        getZoom: () => instance.getZoom() + 1,
        setZoom: (zoom) => { if (zoom !== undefined) instance.setZoom(zoom - 1) },
        getBounds: () => {
          const b = instance.getBounds()
          return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
        },
        panTo: (position) => { const p = literal(position); instance.setCenter([p.lng, p.lat]) },
        moveCamera: ({ center, zoom }) => {
          const p = center ? literal(center) : undefined
          instance.jumpTo({ ...(p ? { center: [p.lng, p.lat] } : {}), ...(zoom !== undefined ? { zoom: zoom - 1 } : {}) })
        },
        fitBounds: (bounds, padding = 40) => {
          const b = 'toJSON' in bounds ? bounds.toJSON() : bounds
          const inset = typeof padding === 'number' ? padding : { top: padding.top ?? 0, bottom: padding.bottom ?? 0, left: padding.left ?? 0, right: padding.right ?? 0 }
          instance.fitBounds([[b.west, b.south], [b.east < b.west ? b.east + 360 : b.east, b.north]], { padding: inset, duration: 0, maxZoom: 20 })
        },
      })
      sync()
    })
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(host.current!)
    return () => { live = false; for (const finish of pendingLoads) finish(); latest.current.onNavigation(null); resize.disconnect(); window.removeEventListener('unhandledrejection', licensingError); shade.current?.remove(); shade.current = null; instance.remove() }
  }, [key])
  useEffect(() => {
    const pending = tool.kind === 'camera' && tool.position && tool.cameraType !== '360'
      ? { id: 'pending', label: 'Choose direction', type: tool.cameraType, position: tool.position, directionDegrees: tool.directionDegrees } : null
    const brief = pending ? { ...session.brief, angles: [...session.brief.angles, pending] } : session.brief
    if (map && ready) (map.getSource('brief-scene') as GeoJSONSource)?.setData(shadeScene(brief, session.visibility, view.zoom, dark))
  }, [map, ready, session.brief, session.visibility, view.zoom, tool, dark])
  useEffect(() => { if (map) map.getCanvas().style.cursor = session.mode === 'edit' && tool.kind !== 'idle' ? 'crosshair' : '' }, [map, session.mode, tool.kind])
  useEffect(() => { shade.current?.setDate(new Date(timestamp)) }, [timestamp, ready])
  const markers = [
    { id: 'project', label: 'Project location', position: session.brief.coordinates, Icon: MapPin, color: mapBrandColor(dark) },
    ...(tool.kind === 'camera' && tool.position ? [{ id: 'pending', label: 'Choose direction', position: tool.position, Icon: cameraAppearance[tool.cameraType].Icon, color: cameraAppearance[tool.cameraType].color }] : []),
    ...(session.visibility.angles ? session.brief.angles.map((angle) => ({ ...angle, Icon: cameraAppearance[angle.type].Icon, color: cameraAppearance[angle.type].color })) : []),
  ]
  return <div className="absolute inset-0 isolate bg-muted" aria-label="ShadeMap preview">
    <div ref={host} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    {ready && map && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="Brief objects">
      {markers.map(({ id, label, position, Icon, color }) => {
        const pixel = map.project([position.lng, position.lat])
        return <div key={id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pixel.x, top: pixel.y }}>
          <Badge className="flex size-9 justify-center rounded-full border-2 bg-white shadow-sm" style={{ color, borderColor: color }}><Icon className="size-5" /></Badge>
          <Badge variant="secondary" className="absolute top-full mt-1 whitespace-nowrap">{label}</Badge>
        </div>
      })}
    </div>}
    {(!key || error || !ready) && <p role="status" className="absolute inset-x-3 top-28 z-10 mx-auto max-w-md rounded-md border bg-card p-3 text-sm shadow-sm">
      {!key ? 'Add VITE_SHADEMAP_API_KEY to .env.local and restart Vite to enable shadows.' : error || 'Loading shadow map…'}
    </p>}
    <div className="absolute bottom-7 left-1/2 z-10 grid w-[calc(100%-24px)] max-w-sm -translate-x-1/2 gap-2 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex justify-between gap-2 text-sm"><span>Shadow time</span><strong>{time.actualTime}</strong></div>
      <Slider value={[minutes]} min={0} max={1435} step={5} onValueChange={([value]) => onMinutesChange(value)} thumbProps={{ 'aria-label': 'Shadow time', 'aria-valuetext': `${timeLabel(minutes)} ${time.zone}` }} />
      <p className="text-xs text-muted-foreground">{session.brief.project.date} · {time.zone}{time.adjusted ? ' · adjusted for daylight saving' : ''}</p>
    </div>
    <div className="absolute bottom-0 left-0 z-10 bg-white/90 px-1 text-[10px] text-black">
      <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://shademap.app/" target="_blank" rel="noreferrer">ShadeMap</a>
    </div>
  </div>
}

import { numberedCameras, nextCameraNumber } from '@/features/briefs/model/camera-numbers'
import { attachShadePlacement } from './shade-placement'
import { attachShadeMapPan } from './shade-map-pan'
import { ShadeProjection } from './shade-projection'
import { attachShadeViewSync } from './shade-view-sync'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Map as LibreMap, type GeoJSONSource } from 'maplibre-gl'
import ShadeMap from 'mapbox-gl-shadow-simulator'
import type { Position } from '@/features/briefs/model/brief'
import type { MapNavigation } from './map-navigation'
import { idleTool, type MapTool } from './placement'
import { shadowBuildings } from './shadow-buildings'
import { CameraMarker } from './camera-marker'
import { RigObject } from './rig-object'
import { ObjectRenderer } from './object-renderer'
import { ShadeMarker, ShadePolygon } from './shade-object-renderer'
import { metersPerPixel } from './geometry'
import { MapObjectScale, mapObjectScale } from './map-object-scale'
import { Slider } from '@/components/ui/slider'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'
import { fromShadeView, toShadeView, type MapView } from './map-view'
import { shadeScene } from './shade-scene'
import { shadowTime, timeLabel } from './shadow-time'
import { useDarkMode } from '@/lib/use-dark-mode'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = { dimOpacity: number; objectSizePercent: number; dispatch: (action: BriefAction) => void; selectedId: string | null; selectedCameraIds: string[]; onSelect: (id: string | null) => void; onSelectCamera: (id: string, additive: boolean) => void; session: BriefSession; initialView: MapView; onViewChange: (view: MapView) => void; minutes: number; onMinutesChange: (value: number) => void; onNavigation: (navigation: MapNavigation | null) => void; tool: MapTool; onMapClick: (point: Position) => void; onToolChange: (tool: MapTool) => void; onCameraPlace: (tool: MapTool, point: Position) => void }
export function ShadeMapPanel({ dimOpacity, objectSizePercent, dispatch, selectedId, selectedCameraIds, onSelect, onSelectCamera, session, initialView, onViewChange, minutes, onMinutesChange, onNavigation, tool, onMapClick, onToolChange, onCameraPlace }: Props) {
  const dark = useDarkMode()
  const host = useRef<HTMLDivElement>(null)
  const shade = useRef<ShadeMap | null>(null)
  const latest = useRef({ session, onViewChange, minutes, onNavigation, onMapClick, tool, onToolChange, onCameraPlace, objectSizePercent })
  useLayoutEffect(() => { latest.current = { session, onViewChange, minutes, onNavigation, onMapClick, tool, onToolChange, onCameraPlace, objectSizePercent } }, [session, onViewChange, minutes, onNavigation, onMapClick, tool, onToolChange, onCameraPlace, objectSizePercent])
  const startView = useRef(initialView)
  const [map, setMap] = useState<LibreMap | null>(null)
  const [view, setView] = useState(initialView)
  const objectScale = mapObjectScale(view.zoom, objectSizePercent)
  const [timeCenter, setTimeCenter] = useState(initialView.center)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const key = import.meta.env.VITE_SHADEMAP_API_KEY?.trim()
  const time = useMemo(() => shadowTime(session.brief.project.date, minutes, timeCenter), [session.brief.project.date, minutes, timeCenter])
  const timestamp = time.instant.getTime()
  useEffect(() => {
    let live = true
    let instance: LibreMap
    try {
      instance = new LibreMap({ container: host.current!, style: 'https://tiles.openfreemap.org/styles/liberty',
        ...toShadeView(startView.current), minZoom: -1, maxZoom: 23, pitch: 0, maxPitch: 0, bearing: 0,
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
    const detachViewSync = attachShadeViewSync(instance, (next) => {
      if (!live) return
      setView(next); latest.current.onViewChange(next)
    })
    instance.on('moveend', () => { if (live) setTimeCenter(fromShadeView(instance.getCenter(), instance.getZoom()).center) })
    instance.on('click', (event) => { if (latest.current.tool.kind !== 'camera') latest.current.onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng }) })
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
      // Show flat footprints at every building zoom; source heights still drive shadows.
      for (const layer of instance.getStyle().layers) {
        if (!('source-layer' in layer) || layer['source-layer'] !== 'building') continue
        if (layer.type === 'fill-extrusion') instance.setLayoutProperty(layer.id, 'visibility', 'none')
        if (layer.type === 'fill') instance.setLayerZoomRange(layer.id, layer.minzoom ?? 0, 24)
      }
      instance.addSource('brief-scene', { type: 'geojson', data: shadeScene(latest.current.session.brief, { ...latest.current.session.visibility, circleRig: false, angles: false }, startView.current.zoom) })
      instance.addLayer({ id: 'brief-fill', type: 'fill', source: 'brief-scene', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } })
      instance.addLayer({ id: 'brief-outline', type: 'line', source: 'brief-scene', paint: { 'line-color': ['get', 'color'], 'line-width': 2 * mapObjectScale(startView.current.zoom, latest.current.objectSizePercent) } })
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
    return () => { live = false; detachViewSync(); for (const finish of pendingLoads) finish(); latest.current.onNavigation(null); resize.disconnect(); window.removeEventListener('unhandledrejection', licensingError); shade.current?.remove(); shade.current = null; instance.remove() }
  }, [key])
  useEffect(() => {
    // Interactive camera and rig geometry is rendered by the shared object controls.
    if (map && ready) (map.getSource('brief-scene') as GeoJSONSource)?.setData(shadeScene(session.brief, { ...session.visibility, circleRig: false, angles: false }, view.zoom))
  }, [map, ready, session.brief, session.visibility, view.zoom])
  useEffect(() => { if (map && ready) map.setPaintProperty('brief-outline', 'line-width', 2 * objectScale) }, [map, ready, objectScale])
  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()
    const restingCursor = session.mode === 'edit' && tool.kind !== 'idle' ? 'crosshair' : 'default'
    const start = () => { canvas.style.cursor = 'move' }
    const end = () => { canvas.style.cursor = restingCursor }
    end()
    map.on('dragstart', start)
    map.on('dragend', end)
    window.addEventListener('blur', end)
    window.addEventListener('pointercancel', end)
    return () => {
      map.off('dragstart', start)
      map.off('dragend', end)
      window.removeEventListener('blur', end)
      window.removeEventListener('pointercancel', end)
      canvas.style.cursor = ''
    }
  }, [map, session.mode, tool.kind])
  useEffect(() => { if (map && host.current?.parentElement) return attachShadeMapPan(map, host.current.parentElement) }, [map])
  const cameraType = session.mode === 'edit' && tool.kind === 'camera' ? tool.cameraType : null
  useEffect(() => {
    if (!map || !cameraType || !host.current?.parentElement) return
    return attachShadePlacement(map, host.current.parentElement, () => ({ tool: latest.current.tool, onToolChange: latest.current.onToolChange, onPlace: latest.current.onCameraPlace }))
  }, [map, cameraType])
  useEffect(() => { shade.current?.setDate(new Date(timestamp)) }, [timestamp, ready])
  const editable = session.mode === 'edit'
  const interactive = tool.kind === 'idle'
  const pendingAngle = tool.kind === 'camera' && tool.position && tool.cameraType !== '360'
    ? { id: 'pending', label: 'Choose direction', type: tool.cameraType, position: tool.position, directionDegrees: tool.directionDegrees } : null
  return <div className="absolute inset-0 isolate bg-muted" aria-label="ShadeMap preview" onContextMenu={(event) => { event.preventDefault(); if (editable) onToolChange(idleTool) }}>
    <div ref={host} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: '#282828', opacity: dimOpacity / 100 }} />
    {ready && map && <ShadeProjection value={map}><ObjectRenderer value={{ Marker: ShadeMarker, Polygon: ShadePolygon }}><MapObjectScale value={objectScale}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-label="Brief objects">
        {session.visibility.circleRig && session.brief.circleRig && <RigObject rig={session.brief.circleRig} pixelsToMeters={metersPerPixel(session.brief.circleRig.position.lat, view.zoom)} dark={dark} editable={editable} interactive={interactive}
          selected={selectedId === session.brief.circleRig.id} onSelect={() => onSelect(session.brief.circleRig!.id)}
          onCommit={(rig) => dispatch({ type: 'update', update: (brief) => ({ ...brief, circleRig: brief.circleRig?.id === rig.id ? rig : brief.circleRig }) })} />}
        {session.visibility.angles && numberedCameras(session.brief.angles).map(({ angle, number }) => <CameraMarker key={angle.id} angle={angle} editable={editable} interactive={interactive}
          number={number} dslrSettings={session.brief.typeSettings.dslr}
          selected={selectedCameraIds.includes(angle.id)} pixelsToMeters={metersPerPixel(angle.position.lat, view.zoom)}
          onSelect={(additive = false) => onSelectCamera(angle.id, additive)}
          onCommit={(updated) => dispatch({ type: 'update', update: (brief) => ({ ...brief, angles: brief.angles.map((item) => item.id === updated.id ? updated : item) }) })} />)}
        {pendingAngle && <CameraMarker angle={pendingAngle} editable={false} interactive={false} selected={false}
          number={nextCameraNumber(session.brief.angles, pendingAngle.type)} dslrSettings={session.brief.typeSettings.dslr}
          pixelsToMeters={metersPerPixel(pendingAngle.position.lat, view.zoom)} onSelect={() => {}} onCommit={() => {}} />}
      </div>
    </MapObjectScale></ObjectRenderer></ShadeProjection>}
    {(!key || error || !ready) && <p role="status" className="absolute inset-x-3 top-28 z-10 mx-auto max-w-md rounded-md border bg-card p-3 text-sm shadow-sm">
      {!key ? 'Add VITE_SHADEMAP_API_KEY to .env.local and restart Vite to enable shadows.' : error || 'Loading shadow map…'}
    </p>}
    <div className="absolute right-3 bottom-[5.5rem] z-10 grid w-[calc(100%-196px)] max-w-sm gap-1 rounded-lg border bg-card p-2 shadow-sm @min-[750px]:right-auto @min-[750px]:bottom-8 @min-[750px]:left-1/2 @min-[750px]:w-[calc(100%-384px)] @min-[750px]:-translate-x-1/2 @min-[750px]:gap-2 @min-[750px]:p-3">
      <div className="flex justify-between gap-2 text-sm"><span>Shadow time</span><strong>{time.actualTime}</strong></div>
      <Slider value={[minutes]} min={0} max={1435} step={5} onValueChange={([value]) => onMinutesChange(value)} thumbProps={{ 'aria-label': 'Shadow time', 'aria-valuetext': `${timeLabel(minutes)} ${time.zone}` }} />
      <p className="text-xs text-muted-foreground">{session.brief.project.date} · {time.zone}{time.adjusted ? ' · adjusted for daylight saving' : ''}</p>
    </div>
    <div className="absolute bottom-0 left-0 z-10 bg-white/90 px-1 text-[10px] text-black">
      <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://shademap.app/" target="_blank" rel="noreferrer">ShadeMap</a>
    </div>
  </div>
}

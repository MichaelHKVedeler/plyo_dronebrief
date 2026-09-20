import { ImageLayer } from './image-layer'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { usePdfMapCapture, waitForMapIdle } from './use-pdf-map-capture'
import type { ImageLayerState } from './image-interaction'
import type { LocalImages } from '@/features/briefs/state/use-local-images'
import { useCameraFocus } from './use-camera-focus'
import { duplicateCamera, nextCameraLabelNumber } from '@/features/briefs/model/camera-numbers'
import { lazy, Suspense, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { initialRigRadius } from './initial-rig-radius'
import { ButtonGroup } from '@/components/ui/button-group'
import { useDarkMode } from '@/lib/use-dark-mode'
import type { MapNavigation } from './map-navigation'
import { ViewerLayers } from './viewer-layers'
import { GoogleMapView } from './google-map-view'
import { MapDimmerControl } from './map-dimmer-control'
import { MapObjectSizeControl } from './map-object-size-control'
import { BasemapDimmer } from './basemap-dimmer'
import { overlayZoomAfterGoogleRestore, type MapView } from './map-view'
import { APIProvider, Map, Polygon, useApiLoadingStatus, APILoadingStatus, useMap } from '@vis.gl/react-google-maps'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'
import { projectWithShoots, shootSlots, type CameraAngle, type Position, type ShootSlot } from '@/features/briefs/model/brief'
import { CameraMarkers } from './camera-markers'
import { RigObject } from './rig-object'
import { MapControls } from './map-controls'
import { MapSearch } from './map-search'
import { CameraPlacementGesture } from './camera-placement-gesture'
import { MiddleMousePan } from './middle-mouse-pan'
import { metersPerPixel } from './geometry'
import { MapObjectScale, mapObjectScale } from './map-object-scale'
import { idleTool, placeCamera, type MapTool } from './placement'
import { isolatedCaptureAngles, isolatedCaptureVisibility, type IsolatedCapture } from './isolated-capture'
import { ResponsiveShadowTimeControl } from './shadow-time-control'
import { previewShootSlot, type ShootEndpoint } from './shoot-time-range'

type Props = {
  pdfMapRef?: RefObject<PdfMapCapture | null>
  images: LocalImages
  rigPlacementRef?: RefObject<(() => { position: Position; radiusMeters: number }) | null>
  focusPosition?: Position | null
  onViewCenterChange?: (center: Position) => void
  selectedCameraIds: string[]
  onSelectCamera: (id: string, additive: boolean) => void
  session: BriefSession
  dispatch: (action: BriefAction) => void
  tool: MapTool
  onToolChange: (tool: MapTool) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  presentation?: 'briefing'
  objectSizePercent?: number
  overlaySizeRef?: RefObject<number>
  isolatedKind?: IsolatedCapture
}
const ShadeMapPanel = lazy(() => import('./shade-map').then((module) => ({ default: module.ShadeMapPanel })))
type GoogleProps = Props & { imageLayer: ImageLayerState; active: boolean; dimOpacity: number; objectSizePercent: number; zoom: number; view: RefObject<MapView>; onViewChange: (view: MapView) => void; satellite: boolean; onMapClick: (point: Position) => void; onCameraPlace: (tool: MapTool, point: Position) => void; onCameraDuplicate: (source: CameraAngle, position: Position) => void }
function ConnectedMap({ imageLayer, selectedCameraIds, onSelectCamera, session, dispatch, tool, onToolChange, selectedId, onSelect, active, dimOpacity, objectSizePercent, zoom, view, onViewChange, satellite, onMapClick, onCameraPlace, onCameraDuplicate, isolatedKind = null }: GoogleProps) {
  const status = useApiLoadingStatus()
  const dark = useDarkMode()
  const objectScale = mapObjectScale(zoom, objectSizePercent)
  const googleRestore = useRef({ holding: false, baseline: null as number | null })
  useLayoutEffect(() => { if (!active) googleRestore.current = { holding: true, baseline: null } }, [active])
  const [middlePanning, setMiddlePanning] = useState(false)
  const { brief, visibility, mode } = session
  const editing = mode === 'edit'
  const interactive = tool.kind === 'idle'
  const objectsInteractive = interactive && !middlePanning
  const capture = isolatedCaptureVisibility(visibility, isolatedKind)
  const captureAngles = isolatedCaptureAngles(brief.angles, isolatedKind)
  const pendingAngle: CameraAngle | null = tool.kind === 'camera' && tool.position && tool.cameraType !== '360'
    ? { id: 'placement-preview', label: 'Choose direction', type: tool.cameraType, position: tool.position, directionDegrees: tool.directionDegrees }
    : null
  const commitCamera = useCallback((updated: CameraAngle) => {
    dispatch({ type: 'update', update: (b) => ({ ...b, angles: b.angles.map((item) => item.id === updated.id ? updated : item) }) })
  }, [dispatch])
  const duplicateCameraAt = useCallback((source: CameraAngle, position: Position) => { onCameraDuplicate(source, position) }, [onCameraDuplicate])
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <MapMessage title="Map could not load" description="Check your map configuration and connection. The brief is still available." />
  if (status !== APILoadingStatus.LOADED) return <MapMessage title="Loading Google Maps…" description="Your brief is ready while the map connects." />
  return <>
    <Map defaultCenter={view.current.center} defaultZoom={view.current.zoom} colorScheme={dark ? 'DARK' : 'LIGHT'} reuseMaps
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} disableDefaultUI
      tilt={0} heading={0} gestureHandling={middlePanning || (editing && tool.kind === 'camera') ? 'none' : 'greedy'} isFractionalZoomEnabled
      draggableCursor={middlePanning ? 'move' : editing && !interactive ? 'crosshair' : 'default'} draggingCursor="move"
      onCameraChanged={(event) => {
        if (!active) return
        const restore = googleRestore.current
        if (restore.holding) {
          const next = overlayZoomAfterGoogleRestore(view.current.zoom, event.detail.zoom, restore.baseline)
          restore.baseline = next.baseline
          restore.holding = next.baseline !== null
          onViewChange({ center: restore.holding ? view.current.center : event.detail.center, zoom: next.zoom })
          return
        }
        onViewChange({ center: event.detail.center, zoom: event.detail.zoom })
      }}
      onClick={(event) => {
        if (!active || middlePanning || tool.kind === 'camera') return
        const source = event.domEvent
        if (source instanceof MouseEvent && (source.ctrlKey || source.shiftKey)) return
        if (source?.composedPath().some((target) => target instanceof Element && target.closest('gmp-advanced-marker'))) return
        if (event.detail.latLng) onMapClick(event.detail.latLng)
      }}>
      {active && <MapObjectScale value={objectScale}>
      {capture.circleRig && brief.circleRig && <RigObject rig={brief.circleRig} pixelsToMeters={metersPerPixel(brief.circleRig.position.lat, zoom)} dark={dark} editable={editing} interactive={objectsInteractive}
        selected={selectedId === brief.circleRig.id}
        onSelect={() => onSelect(brief.circleRig!.id)}
        onCommit={(rig) => dispatch({ type: 'update', update: (b) => ({ ...b, circleRig: b.circleRig?.id === rig.id ? rig : b.circleRig }) })} />}
      {capture.angles && <CameraMarkers angles={captureAngles} pendingAngle={pendingAngle} editable={editing} interactive={objectsInteractive}
        selectedCameraIds={selectedCameraIds} zoom={zoom} dslrSettings={brief.typeSettings.dslr}
        onSelectCamera={onSelectCamera} onCommit={commitCamera} onDuplicate={duplicateCameraAt} />}
      {visibility.polygons && brief.polygons.map((polygon) => <Polygon key={polygon.id} paths={polygon.vertices} strokeColor="#b45309" strokeWeight={3 * objectScale} fillColor="#d97706" fillOpacity={0.2} clickable={false} />)}
      </MapObjectScale>}
      {active && <MiddleMousePan onActiveChange={setMiddlePanning} />}
      {active && editing && <CameraPlacementGesture tool={tool} onToolChange={onToolChange} onPlace={onCameraPlace} />}
      {active && <ImageLayer {...imageLayer} interactive={imageLayer.interactive && !middlePanning} />}
      <GoogleMapView active={active} satellite={satellite} view={view} />
      <BasemapDimmer opacity={dimOpacity} />
    </Map>
  </>
}
function MapMessage({ title, description }: { title: string; description: string }) {
  return <div data-pdf-map-unavailable className="flex h-full min-h-0 items-center justify-center overflow-auto bg-muted/60 p-4 sm:p-8">
    <div className="max-w-sm text-center"><MapPin className="mx-auto mb-4 size-9 text-primary" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
  </div>
}
function MapWorkspace(props: Props) {
  const { session, dispatch, tool, onToolChange, onSelect } = props
  const { brief, mode } = session
  const editing = mode === 'edit'
  const briefing = props.presentation === 'briefing'
  const interactive = tool.kind === 'idle'
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  const googleMap = useMap()
  const [anchors, setAnchors] = useState<Record<string, Position>>({})
  const [dimOpacity, setDimOpacity] = useState(briefing ? 0 : 15)
  const [internalObjectSize, setInternalObjectSize] = useState(100)
  const objectSizePercent = props.objectSizePercent ?? internalObjectSize
  if (props.overlaySizeRef) props.overlaySizeRef.current = objectSizePercent
  const [satellite, setSatellite] = useState(editing || briefing)
  const satelliteId = useId()
  const [shadeStart, setShadeStart] = useState<MapView | null>(null)
  const shadeActive = shadeStart !== null
  const [shadeNavigation, setShadeNavigation] = useState<MapNavigation | null>(null)
  useCameraFocus(props.focusPosition, shadeActive ? shadeNavigation : googleMap)
  const [slots, setSlots] = useState(() => shootSlots(brief.project))
  const [activeSlot, setActiveSlot] = useState(0)
  const [activeEndpoint, setActiveEndpoint] = useState<ShootEndpoint>(0)
  const sourceId = useRef(brief.id)
  if (sourceId.current !== brief.id) {
    sourceId.current = brief.id
    setSlots(shootSlots(brief.project))
    setActiveSlot(0)
    setActiveEndpoint(0)
  }
  const shownSlot = previewShootSlot(slots[Math.min(activeSlot, Math.max(slots.length - 1, 0))] ?? { date: brief.project.date, time: brief.project.times[0] ?? '09:00' }, activeEndpoint)
  function commitSlots(next: ShootSlot[]) {
    setSlots(next)
    if (mode === 'edit') dispatch({ type: 'update', update: (b) => ({ ...b, project: projectWithShoots(b.project, next) }) })
  }
  const view = useRef<MapView>({ center: brief.coordinates, zoom: 10 })
  const [zoom, setZoom] = useState(view.current.zoom)
  const viewport = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  usePdfMapCapture(props.pdfMapRef, {
    root: viewport, navigation: shadeActive ? shadeNavigation : googleMap ? {
      getDiv: () => googleMap.getDiv(), getZoom: () => googleMap.getZoom(), setZoom: (z) => googleMap.setZoom(z!),
      panTo: (p) => googleMap.panTo(p), fitBounds: (b, padding) => googleMap.fitBounds(b, padding), moveCamera: (v) => googleMap.moveCamera(v),
      getBounds: () => googleMap.getBounds(), waitForIdle: async (signal) => {
        await Promise.all([waitForMapIdle(googleMap, signal), waitForMapIdle(googleMap, signal, 'tilesloaded', 5000)])
      },
    } : null,
    view, brief, sourceUrl: props.images.sourceUrl, setCapturing, shadowSlot: shadeActive ? shownSlot : undefined,
  })
  const renderedSession = capturing ? { ...session, mode: 'view' as const, visibility: { circleRig: true, angles: true, polygons: true, imageOverlays: true } } : session
  const mapProps = capturing ? { ...props, session: renderedSession, selectedId: null, selectedCameraIds: [], tool: idleTool, isolatedKind: null } : props
  const renderedObjectSize = capturing ? 100 / 2 ** (zoom - 17) : objectSizePercent
  useImperativeHandle(props.rigPlacementRef, () => () => ({
    position: { ...view.current.center },
    radiusMeters: initialRigRadius(view.current, viewport.current?.clientWidth ?? 0, viewport.current?.clientHeight ?? 0),
  }), [])
  const imageLayer: ImageLayerState = {
    images: renderedSession.visibility.imageOverlays ? brief.imageOverlays.map((image) => ({ ...image, opacity: capturing ? image.opacity : props.images.opacityOverrides[image.id] ?? image.opacity })) : [], selectedId: capturing ? null : props.selectedId,
    editable: editing && !capturing, interactive: interactive && !capturing, anchors, sourceUrl: props.images.sourceUrl,
    onSelect: props.onSelect, onAnchor: (id, point) => setAnchors((previous) => ({ ...previous, [id]: point })),
    onCommit: (image) => dispatch({ type: 'update', update: (b) => ({ ...b, imageOverlays: b.imageOverlays.map((item) => item.id === image.id ? image : item) }) }),
  }
  const onViewChange = (next: MapView) => { view.current = next; setZoom(next.zoom); props.onViewCenterChange?.(next.center) }
  function handleMapClick(point: Position) {
    if (!editing) return
    if (tool.kind === 'idle') { onSelect(null); return }
    if (tool.kind === 'camera') handleCameraPlace(tool, point)
  }
  function handleCameraPlace(tool: MapTool, point: Position) {
    if (editing && tool.kind === 'camera') {
      if (brief.angles.length >= 1000) { onToolChange(idleTool); return }
      const result = placeCamera(tool, point, crypto.randomUUID(), nextCameraLabelNumber(brief.angles, tool.cameraType))
      if (result.angle) {
        const angle = result.angle
        dispatch({ type: 'update', update: (b) => ({ ...b, angles: [...b.angles, angle] }) })
        onSelect(angle.id)
      }
      onToolChange(result.tool)
    }
  }
  function handleCameraDuplicate(source: CameraAngle, position: Position) {
    if (!editing || brief.angles.length >= 1000) return
    const angle = duplicateCamera(source, position, crypto.randomUUID(), brief.angles)
    dispatch({ type: 'update', update: (b) => b.angles.length >= 1000 ? b : { ...b, angles: [...b.angles, angle] } })
    onSelect(angle.id)
  }

  return <CardContent ref={viewport} className="@container relative h-full min-h-0 p-0">
    <div data-pdf-map-surface={!shadeActive ? '' : undefined} className="absolute inset-0" style={{ visibility: shadeActive ? 'hidden' : 'visible' }} aria-hidden={shadeActive} inert={shadeActive}>
      {apiKey ? <ConnectedMap {...mapProps} imageLayer={imageLayer} dimOpacity={dimOpacity} objectSizePercent={renderedObjectSize} zoom={zoom} active={!shadeActive} view={view} satellite={satellite} onViewChange={onViewChange} onMapClick={handleMapClick} onCameraPlace={handleCameraPlace} onCameraDuplicate={handleCameraDuplicate} /> : <MapMessage title="Map setup pending" description="Google Maps will appear once connected. Your brief is still available." />}
    </div>
    {!briefing && shadeActive && <Suspense fallback={<MapMessage title="Loading ShadeMap…" description="Preparing the shadow preview." />}>
      <ShadeMapPanel imageLayer={imageLayer} dimOpacity={dimOpacity} objectSizePercent={renderedObjectSize} dispatch={dispatch} selectedId={mapProps.selectedId} selectedCameraIds={mapProps.selectedCameraIds} onSelect={onSelect} onSelectCamera={props.onSelectCamera} session={renderedSession} initialView={shadeStart} onViewChange={onViewChange} slot={shownSlot}
        onNavigation={setShadeNavigation} tool={mapProps.tool} onMapClick={handleMapClick} isolatedKind={mapProps.isolatedKind ?? null}
        onToolChange={onToolChange} onCameraPlace={handleCameraPlace} onCameraDuplicate={handleCameraDuplicate} />
    </Suspense>}
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <div className="col-span-2 min-w-0 @min-[550px]:col-span-1">
        {!briefing && apiKey && <MapSearch navigation={shadeActive ? shadeNavigation : googleMap} />}
      </div>
      <div className="col-start-2 row-start-2 flex flex-col items-end @min-[550px]:row-start-1 @min-[550px]:row-span-2">
        <div className="pointer-events-auto grid w-fit grid-cols-[auto_auto] gap-y-2">
          {!briefing && <ButtonGroup aria-label="Map provider" className="col-span-2 grid !grid grid-cols-subgrid overflow-hidden rounded-lg bg-card shadow-sm">
            <Button size="sm" className="h-10 !rounded-none" variant={!shadeActive ? 'default' : 'ghost'} aria-pressed={!shadeActive} onClick={() => setShadeStart(null)}>Google Maps</Button>
            <Button size="sm" className="h-10 w-full !rounded-none" variant={shadeActive ? 'default' : 'ghost'} aria-pressed={shadeActive} onClick={() => { if (!shadeActive) setShadeStart(view.current) }}>ShadeMap</Button>
          </ButtonGroup>}
          <Label htmlFor={satelliteId} aria-hidden={shadeActive} inert={shadeActive} className={'col-start-2 flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 shadow-sm' + (shadeActive ? ' invisible pointer-events-none' : '')}>
            <Switch id={satelliteId} checked={satellite} onCheckedChange={setSatellite} /><span>Satellite</span>
          </Label>
        </div>
      </div>
      <div className="col-start-1 row-start-2 grid justify-items-start gap-2 @max-[400px]:col-span-2 @max-[400px]:row-start-3">
        {editing && !interactive && <Button className="pointer-events-auto shadow-sm" onClick={() => onToolChange(idleTool)}><X />Cancel placement</Button>}
        <ViewerLayers session={session} dispatch={dispatch} />
      </div>
    </div>
    {!briefing && <div className="pointer-events-auto absolute right-3 bottom-[5.5rem] z-20 grid max-h-[calc(100%-7rem)] w-[calc(100%-196px)] max-w-sm gap-1 overflow-y-auto rounded-lg border bg-card p-2 shadow-sm @min-[750px]:right-auto @min-[750px]:bottom-8 @min-[750px]:left-1/2 @min-[750px]:w-[calc(100%-384px)] @min-[750px]:-translate-x-1/2 @min-[750px]:p-3">
      <ResponsiveShadowTimeControl slots={slots} activeIndex={Math.min(activeSlot, slots.length - 1)} activeEndpoint={activeEndpoint}
        onActivate={(index, endpoint = 0) => { setActiveSlot(index); setActiveEndpoint(endpoint) }} onChange={setSlots} onCommit={commitSlots} position={view.current.center} />
    </div>}
    <div className="pointer-events-none absolute inset-x-3 bottom-8 z-20 flex items-end gap-2">
      {!briefing && <div className="pointer-events-auto grid min-w-0 max-w-40 flex-1 gap-2">
        <MapObjectSizeControl value={objectSizePercent} onChange={setInternalObjectSize} />
        <MapDimmerControl value={dimOpacity} onChange={setDimOpacity} />
      </div>}
      <MapControls brief={brief} navigation={shadeActive ? shadeNavigation : googleMap} />
    </div>
  </CardContent>
}
export function MapPanel(props: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
  return <Card className="relative h-full min-h-0 min-w-0 overflow-hidden py-0" role="region" aria-label="Brief map">
    <APIProvider apiKey={apiKey}><MapWorkspace {...props} /></APIProvider>
  </Card>
}

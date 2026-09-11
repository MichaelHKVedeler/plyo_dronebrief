import { lazy, Suspense, useId, useRef, useState, type RefObject } from 'react'
import { ButtonGroup } from '@/components/ui/button-group'
import { useDarkMode } from '@/lib/use-dark-mode'
import type { MapNavigation } from './map-navigation'
import { ViewerLayers } from './viewer-layers'
import { GoogleMapView } from './google-map-view'
import { BasemapDimmer } from './basemap-dimmer'
import type { MapView } from './map-view'
import { APIProvider, Map, Polygon, AdvancedMarker, useApiLoadingStatus, APILoadingStatus, useMap } from '@vis.gl/react-google-maps'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'
import { cameraLabels, type CameraAngle, type Position } from '@/features/briefs/model/brief'
import { CameraMarker } from './camera-marker'
import { RigObject } from './rig-object'
import { MapControls } from './map-controls'
import { MapSearch } from './map-search'
import { CameraPlacementGesture } from './camera-placement-gesture'
import { MiddleMousePan } from './middle-mouse-pan'
import { metersPerPixel } from './geometry'
import { aimPlacement, idleTool, placeCamera, placementHint, type MapTool } from './placement'

type Props = {
  selectedCameraIds: string[]
  onSelectCamera: (id: string, additive: boolean) => void
  session: BriefSession
  dispatch: (action: BriefAction) => void
  tool: MapTool
  onToolChange: (tool: MapTool) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}
const ShadeMapPanel = lazy(() => import('./shade-map').then((module) => ({ default: module.ShadeMapPanel })))
type GoogleProps = Props & { active: boolean; view: RefObject<MapView>; onViewChange: (view: MapView) => void; satellite: boolean; onMapClick: (point: Position) => void; onCameraPlace: (tool: MapTool, point: Position) => void }
function ConnectedMap({ selectedCameraIds, onSelectCamera, session, dispatch, tool, onToolChange, selectedId, onSelect, active, view, onViewChange, satellite, onMapClick, onCameraPlace }: GoogleProps) {
  const status = useApiLoadingStatus()
  const dark = useDarkMode()
  const [zoom, setZoom] = useState(17)
  const [middlePanning, setMiddlePanning] = useState(false)
  const { brief, visibility, mode } = session
  const editing = mode === 'edit'
  const interactive = tool.kind === 'idle'
  const objectsInteractive = interactive && !middlePanning
  const pendingAngle: CameraAngle | null = tool.kind === 'camera' && tool.position && tool.cameraType !== '360'
    ? { id: 'placement-preview', label: 'Choose direction', type: tool.cameraType, position: tool.position, directionDegrees: tool.directionDegrees }
    : null
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <MapMessage title="Map could not load" description="Check your map configuration and connection. The brief is still available." />
  if (status !== APILoadingStatus.LOADED) return <MapMessage title="Loading Google Maps…" description="Your brief is ready while the map connects." />
  return <>
    <Map defaultCenter={view.current.center} defaultZoom={view.current.zoom} colorScheme={dark ? 'DARK' : 'LIGHT'} reuseMaps
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} disableDefaultUI
      tilt={0} heading={0} gestureHandling={middlePanning || (editing && tool.kind === 'camera') ? 'none' : 'greedy'} isFractionalZoomEnabled
      draggableCursor={editing && !interactive ? 'crosshair' : undefined}
      onZoomChanged={(event) => setZoom(event.detail.zoom)}
      onCameraChanged={(event) => { if (active) onViewChange({ center: event.detail.center, zoom: event.detail.zoom }) }}
      onClick={(event) => {
        if (!active || middlePanning || tool.kind === 'camera') return
        const source = event.domEvent
        if (source instanceof MouseEvent && (source.ctrlKey || source.shiftKey)) return
        if (source?.composedPath().some((target) => target instanceof Element && target.closest('gmp-advanced-marker'))) return
        if (event.detail.latLng) onMapClick(event.detail.latLng)
      }}>
      <AdvancedMarker position={brief.coordinates} title="Project location" zIndex={1}
        draggable={editing && objectsInteractive} style={{ pointerEvents: objectsInteractive ? 'auto' : 'none' }}
        onDragEnd={(event) => {
          if (editing && objectsInteractive && event.latLng) {
            const coordinates = event.latLng.toJSON()
            dispatch({ type: 'update', update: (b) => ({ ...b, coordinates }) })
          }
        }}><MapPin className="size-7 fill-white text-primary" /></AdvancedMarker>
      {visibility.circleRig && brief.circleRig && <RigObject rig={brief.circleRig} dark={dark} editable={editing} interactive={objectsInteractive}
        selected={selectedId === brief.circleRig.id}
        onSelect={() => onSelect(brief.circleRig!.id)}
        onCommit={(rig) => dispatch({ type: 'update', update: (b) => ({ ...b, circleRig: b.circleRig?.id === rig.id ? rig : b.circleRig }) })} />}
      {visibility.angles && brief.angles.map((angle) => <CameraMarker key={angle.id} angle={angle} editable={editing}
        interactive={objectsInteractive} selected={selectedCameraIds.includes(angle.id)} pixelsToMeters={metersPerPixel(angle.position.lat, zoom)}
        onSelect={(additive = false) => onSelectCamera(angle.id, additive)}
        onCommit={(updated) => dispatch({ type: 'update', update: (b) => ({ ...b, angles: b.angles.map((item) => item.id === updated.id ? updated : item) }) })} />)}
      {pendingAngle && <CameraMarker angle={pendingAngle} editable={false} interactive={false} selected={false}
        pixelsToMeters={metersPerPixel(pendingAngle.position.lat, zoom)} onSelect={() => {}} onCommit={() => {}} />}
      {visibility.polygons && brief.polygons.map((polygon) => <Polygon key={polygon.id} paths={polygon.vertices} strokeColor="#b45309" fillColor="#d97706" fillOpacity={0.2} clickable={false} />)}
      {active && <MiddleMousePan onActiveChange={setMiddlePanning} />}
      {active && editing && <CameraPlacementGesture tool={tool} onToolChange={onToolChange} onPlace={onCameraPlace} />}
      <GoogleMapView active={active} satellite={satellite} view={view} />
      <BasemapDimmer />
    </Map>
  </>
}
function MapMessage({ title, description }: { title: string; description: string }) {
  return <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-muted/60 p-4 sm:p-8">
    <div className="max-w-sm text-center"><MapPin className="mx-auto mb-4 size-9 text-primary" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
  </div>
}
function MapWorkspace(props: Props) {
  const { session, dispatch, tool, onToolChange, onSelect } = props
  const { brief, mode } = session
  const editing = mode === 'edit'
  const interactive = tool.kind === 'idle'
  const hint = editing ? placementHint(tool) : null
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  const googleMap = useMap()
  const [satellite, setSatellite] = useState(editing)
  const satelliteId = useId()
  const [shadeStart, setShadeStart] = useState<MapView | null>(null)
  const shadeActive = shadeStart !== null
  const activeHint = shadeActive && tool.kind === 'camera'
    ? (tool.position ? 'Click to choose the camera direction. ' : 'Click to place a camera. ') + 'Keep placing points; Esc or Cancel placement stops.'
    : hint
  const [shadeNavigation, setShadeNavigation] = useState<MapNavigation | null>(null)
  const [minutes, setMinutes] = useState(() => {
    const [hours, mins] = (brief.project.times[0] || '12:00').split(':').map(Number)
    return hours * 60 + mins
  })
  const view = useRef<MapView>({ center: brief.coordinates, zoom: 10 })
  const onViewChange = (next: MapView) => { view.current = next }
  function handleMapClick(point: Position) {
    if (!editing) return
    if (tool.kind === 'idle') { onSelect(null); return }
    if (tool.kind === 'project') {
      dispatch({ type: 'update', update: (b) => ({ ...b, coordinates: point }) })
      onToolChange(idleTool)
    } else if (tool.kind === 'camera') handleCameraPlace(tool, point)
  }
  function handleCameraPlace(tool: MapTool, point: Position) {
    if (editing && tool.kind === 'camera') {
      if (brief.angles.length >= 1000) { onToolChange(idleTool); return }
      let labelNumber = 1
      const labels = new Set(brief.angles.map((angle) => angle.label))
      while (labels.has(cameraLabels[tool.cameraType] + ' ' + labelNumber)) labelNumber++
      const result = placeCamera(tool, point, crypto.randomUUID(), labelNumber)
      if (result.angle) {
        const angle = result.angle
        dispatch({ type: 'update', update: (b) => ({ ...b, angles: [...b.angles, angle] }) })
        onSelect(angle.id)
      }
      onToolChange(result.tool)
    }
  }

  return <CardContent className="@container relative h-full min-h-0 p-0">
    <div className="absolute inset-0" style={{ visibility: shadeActive ? 'hidden' : 'visible' }} aria-hidden={shadeActive} inert={shadeActive}>
      {apiKey ? <ConnectedMap {...props} active={!shadeActive} view={view} satellite={satellite} onViewChange={onViewChange} onMapClick={handleMapClick} onCameraPlace={handleCameraPlace} /> : <MapMessage title="Map setup pending" description="Google Maps will appear once connected. Your brief is still available." />}
    </div>
    {shadeActive && <Suspense fallback={<MapMessage title="Loading ShadeMap…" description="Preparing the shadow preview." />}>
      <ShadeMapPanel session={session} initialView={shadeStart} onViewChange={onViewChange} minutes={minutes} onMinutesChange={setMinutes}
        onNavigation={setShadeNavigation} tool={tool} onMapClick={handleMapClick}
        onAim={(point) => { if (editing && tool.kind === 'camera' && tool.position) onToolChange(aimPlacement(tool, point)) }} />
    </Suspense>}
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <div className="col-span-2 min-w-0 @min-[550px]:col-span-1">
        {apiKey && <MapSearch navigation={shadeActive ? shadeNavigation : googleMap} />}
      </div>
      <div className="col-start-2 row-start-2 flex flex-col items-end gap-2 @min-[550px]:row-start-1 @min-[550px]:row-span-2">
        <ButtonGroup aria-label="Map provider" className="pointer-events-auto shadow-sm">
          <Button size="sm" variant={!shadeActive ? 'default' : 'outline'} aria-pressed={!shadeActive} onClick={() => setShadeStart(null)}>Google Maps</Button>
          <Button size="sm" variant={shadeActive ? 'default' : 'outline'} aria-pressed={shadeActive} onClick={() => { if (!shadeActive) setShadeStart(view.current) }}>ShadeMap</Button>
        </ButtonGroup>
        {!shadeActive && <Label htmlFor={satelliteId} className="pointer-events-auto flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 shadow-sm">
          <Switch id={satelliteId} checked={satellite} onCheckedChange={setSatellite} /><span>Satellite</span>
        </Label>}
      </div>
      <div className="col-start-1 row-start-2 grid justify-items-start gap-2">
        {editing && <Button variant={!interactive ? 'default' : 'secondary'} className="pointer-events-auto shadow-sm"
          onClick={() => { onSelect(null); onToolChange(interactive ? { kind: 'project' } : idleTool) }}>
          {interactive ? <MapPin /> : <X />}{interactive ? 'Set location' : 'Cancel placement'}
        </Button>}
        <ViewerLayers session={session} dispatch={dispatch} />
      </div>
      {activeHint && <Badge className="col-span-2 whitespace-normal py-2" role="status">{activeHint}</Badge>}
    </div>
    <MapControls brief={brief} navigation={shadeActive ? shadeNavigation : googleMap} shadeActive={shadeActive} />
  </CardContent>
}
export function MapPanel(props: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
  return <Card className="relative h-full min-h-0 min-w-0 overflow-hidden py-0" role="region" aria-label="Brief map">
    <APIProvider apiKey={apiKey}><MapWorkspace {...props} /></APIProvider>
  </Card>
}

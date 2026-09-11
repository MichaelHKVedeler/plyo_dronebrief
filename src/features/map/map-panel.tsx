import { useId, useState } from 'react'
import { APIProvider, Map, Polygon, AdvancedMarker, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps'
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
import { metersPerPixel } from './geometry'
import { aimPlacement, idleTool, placeCamera, placementHint, type MapTool } from './placement'

type Props = {
  session: BriefSession
  dispatch: (action: BriefAction) => void
  tool: MapTool
  onToolChange: (tool: MapTool) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}
function ConnectedMap({ session, dispatch, tool, onToolChange, selectedId, onSelect }: Props) {
  const status = useApiLoadingStatus()
  const [satellite, setSatellite] = useState(false)
  const [zoom, setZoom] = useState(17)
  const satelliteId = useId()
  const { brief, visibility, mode } = session
  const editing = mode === 'edit'
  const interactive = tool.kind === 'idle'
  const hint = editing ? placementHint(tool) : null
  function handleMapClick(point: Position) {
    if (!editing) return
    if (tool.kind === 'project') {
      dispatch({ type: 'update', update: (b) => ({ ...b, coordinates: point }) })
      onToolChange(idleTool)
    } else if (tool.kind === 'camera') {
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
  const pendingAngle: CameraAngle | null = tool.kind === 'camera' && tool.position && tool.cameraType !== '360'
    ? { id: 'placement-preview', label: 'Choose direction', type: tool.cameraType, position: tool.position, directionDegrees: tool.directionDegrees }
    : null
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <MapMessage title="Map could not load" description="Check your map configuration and connection. The brief is still available." />
  if (status !== APILoadingStatus.LOADED) return <MapMessage title="Loading Google Maps…" description="Your brief is ready while the map connects." />
  return <>
    <Map defaultCenter={brief.coordinates} defaultZoom={brief.coordinates.lat === 59.9139 && brief.coordinates.lng === 10.7522 ? 10 : brief.coordinates.lat === 0 && brief.coordinates.lng === 0 ? 2 : 17}
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} disableDefaultUI
      mapTypeId={satellite ? 'satellite' : 'roadmap'} tilt={0} gestureHandling="greedy"
      draggableCursor={editing && !interactive ? 'crosshair' : undefined}
      onZoomChanged={(event) => setZoom(event.detail.zoom)}
      onClick={(event) => { if (event.detail.latLng) handleMapClick(event.detail.latLng) }}
      onMousemove={(event) => { if (editing && event.detail.latLng && tool.kind === 'camera' && tool.position) onToolChange(aimPlacement(tool, event.detail.latLng)) }}>
      <AdvancedMarker position={brief.coordinates} title="Project location" zIndex={1}
        draggable={editing && interactive} style={{ pointerEvents: interactive ? 'auto' : 'none' }}
        onDragEnd={(event) => {
          if (editing && event.latLng) {
            const coordinates = event.latLng.toJSON()
            dispatch({ type: 'update', update: (b) => ({ ...b, coordinates }) })
          }
        }}><MapPin className="size-7 fill-white text-primary" /></AdvancedMarker>
      {visibility.circleRig && brief.circleRig && <RigObject rig={brief.circleRig} editable={editing} interactive={interactive}
        selected={selectedId === brief.circleRig.id}
        onSelect={() => onSelect(brief.circleRig!.id)}
        onCommit={(rig) => dispatch({ type: 'update', update: (b) => ({ ...b, circleRig: b.circleRig?.id === rig.id ? rig : b.circleRig }) })} />}
      {visibility.angles && brief.angles.map((angle) => <CameraMarker key={angle.id} angle={angle} editable={editing}
        interactive={interactive} selected={selectedId === angle.id} pixelsToMeters={metersPerPixel(angle.position.lat, zoom)}
        onSelect={() => onSelect(angle.id)}
        onCommit={(updated) => dispatch({ type: 'update', update: (b) => ({ ...b, angles: b.angles.map((item) => item.id === updated.id ? updated : item) }) })} />)}
      {pendingAngle && <CameraMarker angle={pendingAngle} editable={false} interactive={false} selected={false}
        pixelsToMeters={metersPerPixel(pendingAngle.position.lat, zoom)} onSelect={() => {}} onCommit={() => {}} />}
      {visibility.polygons && brief.polygons.map((polygon) => <Polygon key={polygon.id} paths={polygon.vertices} strokeColor="#b45309" fillColor="#d97706" fillOpacity={0.2} clickable={false} />)}
      <MapControls brief={brief} />
      <MapSearch />
    <div className="pointer-events-none absolute inset-x-3 top-16 flex flex-wrap items-start justify-between gap-2">
      {editing && <Button variant={!interactive ? 'default' : 'secondary'} className="pointer-events-auto shadow-sm"
        onClick={() => { onSelect(null); onToolChange(interactive ? { kind: 'project' } : idleTool) }}>
        {interactive ? <MapPin /> : <X />}{interactive ? 'Set location' : 'Cancel placement'}
      </Button>}
      <div className="pointer-events-auto ml-auto flex h-9 items-center gap-2 rounded-md border bg-card px-3 shadow-sm">
        <Switch id={satelliteId} checked={satellite} onCheckedChange={setSatellite} />
        <Label htmlFor={satelliteId}>Satellite</Label>
      </div>
      {hint && <Badge className="w-full whitespace-normal py-2" role="status">{hint}</Badge>}
    </div>
    </Map>
  </>
}
function MapMessage({ title, description }: { title: string; description: string }) {
  return <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-muted/60 p-4 sm:p-8">
    <div className="max-w-sm text-center"><MapPin className="mx-auto mb-4 size-9 text-primary" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
  </div>
}
export function MapPanel(props: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  return <Card className="relative h-full min-h-0 min-w-0 overflow-hidden py-0" role="region" aria-label="Brief map">
    <CardContent className="relative h-full min-h-0 p-0">
      {apiKey ? <APIProvider apiKey={apiKey}><ConnectedMap {...props} /></APIProvider> : <MapMessage title="Map setup pending" description={props.session.mode === 'edit' ? 'Google Maps will appear once connected. You can already set project details, coordinates, and rig settings, then export your brief.' : 'Google Maps will appear once connected. You can view the project details and toggle the layers below.'} />}
    </CardContent>
  </Card>
}

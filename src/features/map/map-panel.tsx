import { useEffect, useId, useState } from 'react'
import { APIProvider, Map, Polygon, AdvancedMarker, useMap, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps'
import { ArrowUp, Camera, LocateFixed, MapPin, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BriefSession } from '@/features/briefs/state/brief-session'
import type { Position } from '@/features/briefs/model/brief'
import { rigOutline } from './geometry'

type Props = { session: BriefSession; onPosition: (position: Position) => void }
function MapControls({ position }: { position: Position }) {
  const map = useMap()
  useEffect(() => { map?.panTo(position) }, [map, position])
  return <div className="absolute bottom-8 right-3 flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
    <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => map?.setZoom((map.getZoom() ?? 2) + 1)}><Plus /></Button>
    <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => map?.setZoom((map.getZoom() ?? 2) - 1)}><Minus /></Button>
    <Button variant="ghost" size="icon" aria-label="Center on project" onClick={() => { map?.panTo(position); map?.setZoom(17) }}><LocateFixed /></Button>
  </div>
}
function ConnectedMap({ session, onPosition }: Props) {
  const status = useApiLoadingStatus()
  const [placing, setPlacing] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const satelliteId = useId()
  const { brief, visibility, mode } = session
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <MapMessage title="Map could not load" description="Check your map configuration and connection. The brief is still available." />
  if (status !== APILoadingStatus.LOADED) return <MapMessage title="Loading Google Maps…" description="Your brief is ready while the map connects." />
  return <>
    <Map defaultCenter={brief.coordinates} defaultZoom={brief.coordinates.lat === 0 && brief.coordinates.lng === 0 ? 2 : 17}
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} disableDefaultUI
      mapTypeId={satellite ? 'satellite' : 'roadmap'} tilt={0} gestureHandling="greedy"
      onClick={(event) => {
        if (mode === 'edit' && placing && event.detail.latLng) { onPosition(event.detail.latLng); setPlacing(false) }
      }}>
      <AdvancedMarker position={brief.coordinates} title="Project location"><MapPin className="size-7 fill-white text-primary" /></AdvancedMarker>
      {visibility.circleRig && brief.circleRig && <Polygon paths={rigOutline(brief.circleRig)} strokeColor="#2958bb" strokeWeight={2} fillColor="#2958bb" fillOpacity={0.12} clickable={false} />}
      {visibility.angles && brief.angles.map((angle) => <AdvancedMarker key={angle.id} position={angle.position} title={angle.label}>
        <Badge className="gap-1">{angle.type === '360' ? <Camera /> : <ArrowUp style={{ transform: 'rotate(' + angle.directionDegrees + 'deg)' }} />}{angle.label}</Badge>
      </AdvancedMarker>)}
      {visibility.polygons && brief.polygons.map((polygon) => <Polygon key={polygon.id} paths={polygon.vertices} strokeColor="#b45309" fillColor="#d97706" fillOpacity={0.2} clickable={false} />)}
      <MapControls position={brief.coordinates} />
    </Map>
    <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
      {mode === 'edit' && <Button variant={placing ? 'default' : 'secondary'} className="pointer-events-auto shadow-sm" onClick={() => setPlacing(!placing)}><MapPin />{placing ? 'Cancel placement' : 'Set location'}</Button>}
      <div className="pointer-events-auto ml-auto flex h-9 items-center gap-2 rounded-md border bg-card px-3 shadow-sm">
        <Switch id={satelliteId} checked={satellite} onCheckedChange={setSatellite} />
        <Label htmlFor={satelliteId}>Satellite</Label>
      </div>
      {placing && mode === 'edit' && <Badge className="w-fit whitespace-normal">Click the map to set the project location.</Badge>}
    </div>
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

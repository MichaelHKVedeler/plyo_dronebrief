import { useEffect, useState } from 'react'
import { APIProvider, Map, Polygon, AdvancedMarker, useMap, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps'
import { ArrowUp, Camera, LocateFixed, MapPin, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  const { brief, visibility, mode } = session
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <MapMessage title="Map could not load" description="Check your map configuration and connection. The brief is still available." />
  if (status !== APILoadingStatus.LOADED) return <MapMessage title="Loading Google Maps…" description="Your brief is ready while the map connects." />
  return <>
    <Map defaultCenter={brief.coordinates} defaultZoom={brief.coordinates.lat === 0 && brief.coordinates.lng === 0 ? 2 : 17}
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} disableDefaultUI
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
    {mode === 'edit' && <Button variant={placing ? 'default' : 'secondary'} className="absolute left-3 top-3 shadow-sm" onClick={() => setPlacing(!placing)}><MapPin />{placing ? 'Click map to set location · Cancel' : 'Set project location'}</Button>}
  </>
}
function MapMessage({ title, description }: { title: string; description: string }) {
  return <div className="flex h-full min-h-80 items-center justify-center bg-muted/60 p-8">
    <div className="max-w-sm text-center"><MapPin className="mx-auto mb-4 size-9 text-primary" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
  </div>
}
export function MapPanel(props: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  return <Card className="relative min-h-[420px] overflow-hidden py-0 lg:min-h-[640px]">
    <CardContent className="relative h-[420px] p-0 lg:h-[640px]">
      {apiKey ? <APIProvider apiKey={apiKey}><ConnectedMap {...props} /></APIProvider> : <MapMessage title="Map setup pending" description={props.session.mode === 'edit' ? 'Google Maps will appear once connected. You can already set project details, coordinates, and rig settings, then export your brief.' : 'Google Maps will appear once connected. You can view the project details and toggle the layers below.'} />}
    </CardContent>
  </Card>
}

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cameraLabels, cameraTypes, type DroneBrief } from '../model/brief'
import type { BriefSession } from '../state/brief-session'

type Props = { session: BriefSession; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const id = useId()
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input key={value} id={id} type="number" step="any" min={min} max={max} defaultValue={value} onBlur={(event) => {
    const next = event.currentTarget.valueAsNumber
    if (!Number.isFinite(next) || next < min || next > max) { event.currentTarget.value = String(value); return }
    if (next !== value) onChange(next)
  }} /></div>
}
export function ProjectPanel({ session, onUpdate }: Props) {
  const { brief, mode } = session
  if (mode === 'view') return <div className="grid gap-4 text-sm">
    <dl className="grid gap-4">
      <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1 font-medium">{brief.project.clientName}</dd></div>
      <div><dt className="text-muted-foreground">Shoot date</dt><dd className="mt-1">{brief.project.date}</dd></div>
      <div><dt className="text-muted-foreground">Shoot times</dt><dd className="mt-1">{brief.project.times.join(', ')}</dd></div>
      <div><dt className="text-muted-foreground">Coordinates</dt><dd className="mt-1">{brief.coordinates.lat}, {brief.coordinates.lng}</dd></div>
    </dl>
    <Separator />
    {cameraTypes.map((type) => <div key={type}><p className="font-medium">{cameraLabels[type]}</p><p className="mt-1 text-muted-foreground">{brief.typeSettings[type].heightsMeters.join(', ') || 'None'} m</p></div>)}
  </div>
  return <div className="grid gap-5">
    <div className="grid gap-2"><Label htmlFor="edit-project-name">Project name</Label><Input key={brief.id} id="edit-project-name" defaultValue={brief.project.name} maxLength={200} onBlur={(e) => {
      const name = e.target.value.trim()
      if (name) onUpdate((b) => ({ ...b, project: { ...b.project, name } }))
      else e.target.value = brief.project.name
    }} /></div>
    <p className="text-sm text-muted-foreground">{brief.project.clientName}<br />{brief.project.date} · {brief.project.times.join(', ')}</p>
    <Separator />
    <p className="text-sm font-medium">Project location</p>
    <NumberField label="Latitude" value={brief.coordinates.lat} min={-90} max={90} onChange={(lat) => onUpdate((b) => ({ ...b, coordinates: { ...b.coordinates, lat } }))} />
    <NumberField label="Longitude" value={brief.coordinates.lng} min={-180} max={180} onChange={(lng) => onUpdate((b) => ({ ...b, coordinates: { ...b.coordinates, lng } }))} />
    <Separator />
    <p className="text-sm font-medium">Circle rig</p>
    {brief.circleRig ? <>
      <NumberField label="Radius (m)" value={brief.circleRig.radiusMeters} min={0.1} max={10000} onChange={(radiusMeters) => onUpdate((b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters } }))} />
      <NumberField label="Oval ratio (1 = circle)" value={brief.circleRig.ovalRatio} min={0.1} max={1} onChange={(ovalRatio) => onUpdate((b) => ({ ...b, circleRig: { ...b.circleRig!, ovalRatio } }))} />
      <NumberField label="Rig rotation (degrees)" value={brief.circleRig.rotationDegrees} min={0} max={359.99} onChange={(rotationDegrees) => onUpdate((b) => ({ ...b, circleRig: { ...b.circleRig!, rotationDegrees } }))} />
      <Button variant="outline" onClick={() => onUpdate((b) => ({ ...b, circleRig: { ...b.circleRig!, position: { ...b.coordinates } } }))}>Move rig to project location</Button>
      <Button variant="ghost" onClick={() => onUpdate((b) => ({ ...b, circleRig: null }))}>Remove rig</Button>
    </> : <Button variant="outline" onClick={() => onUpdate((b) => ({ ...b, circleRig: { id: crypto.randomUUID(), position: { ...b.coordinates }, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0 } }))}>Add circle rig at project location</Button>}
    <Separator />
    <p className="text-sm font-medium">Camera heights</p>
    {cameraTypes.map((type) => <div className="grid gap-2" key={type}>
      <Label htmlFor={'heights-' + type}>{cameraLabels[type]} heights (m)</Label>
      <Input id={'heights-' + type} defaultValue={brief.typeSettings[type].heightsMeters.join(', ')} onBlur={(event) => {
        const text = event.target.value.trim()
        const tokens = text.split(',').map((item) => item.trim())
        const heightsMeters = text ? tokens.map((item) => item ? Number(item) : NaN) : []
        if (heightsMeters.length > 50 || heightsMeters.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) {
          event.target.value = brief.typeSettings[type].heightsMeters.join(', '); return
        }
        onUpdate((b) => ({ ...b, typeSettings: { ...b.typeSettings, [type]: { heightsMeters } } }))
      }} />
    </div>)}
    <p className="text-sm text-muted-foreground">Separate multiple heights with commas. Fields save when you leave them.</p>
  </div>
}

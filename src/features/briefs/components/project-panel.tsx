import { useState } from 'react'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cameraLabels, cameraTypes, type CameraAngle, type DroneBrief } from '../model/brief'
import { CameraAddPanel } from './camera-add-panel'
import { RigRadii } from './rig-radii'
import { CamerasPanel } from './cameras-panel'
import { NumberField } from './number-field'
import type { BriefSession } from '../state/brief-session'

type Props = { onAddRig: () => void; selectedCameraIds: string[]; onSelectCamera: (id: string, range: boolean) => void; onRemoveCameras: (ids: string[]) => void; session: BriefSession; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void; selectedId: string | null; onSelect: (id: string | null) => void; onAddCamera: (type: CameraAngle['type']) => void }
export function ProjectPanel({ onAddRig, selectedCameraIds, onSelectCamera, onRemoveCameras, session, onUpdate, selectedId, onSelect, onAddCamera }: Props) {
  const { brief, mode } = session
  const [open, setOpen] = useState<string[]>(mode === 'edit' ? ['add-cameras', 'cameras'] : ['project'])
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const selectedSection = selectedId ? (selectedId === brief.circleRig?.id ? 'rig' : 'cameras') : null
  if (lastSelected !== selectedId) {
    setLastSelected(selectedId)
    if (selectedSection) setOpen((previous) => previous.includes(selectedSection) ? previous : [...previous, selectedSection])
  }
  if (mode === 'view') return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="project" title="Project details">
    <dl className="grid gap-4">
      <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1 font-medium">{brief.project.clientName}</dd></div>
      <div><dt className="text-muted-foreground">Shoot date</dt><dd className="mt-1">{brief.project.date}</dd></div>
      <div><dt className="text-muted-foreground">Shoot times</dt><dd className="mt-1">{brief.project.times.join(', ')}</dd></div>
    </dl>
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
      {brief.angles.length ? brief.angles.map((angle) => <div key={angle.id} className="text-sm">
        <p className="font-medium">{angle.label} · {cameraLabels[angle.type]}</p>
        <p className="text-muted-foreground">{angle.position.lat.toFixed(6)}, {angle.position.lng.toFixed(6)}{angle.type !== '360' && ' · ' + angle.directionDegrees.toFixed(1) + '°'}</p>
      </div>) : <p>No camera points in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
      {brief.circleRig ? <RigRadii rig={brief.circleRig} /> : <p>No circle rig in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="heights" title="Camera heights">
    {cameraTypes.map((type) => <div key={type}><p className="font-medium">{cameraLabels[type]}</p><p className="mt-1 text-muted-foreground">{brief.typeSettings[type].heightsMeters.join(', ') || 'None'} m</p></div>)}
    </SettingsSection>
  </Accordion>
  return <div>
    <p className="pb-3 text-sm text-muted-foreground">{brief.project.clientName}<br />{brief.project.date} · {brief.project.times.join(', ')}</p>
    <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="project" title="Project details">
    <div className="grid gap-2"><Label htmlFor="edit-project-name">Project name</Label><Input key={brief.id} id="edit-project-name" defaultValue={brief.project.name} maxLength={200} onBlur={(e) => {
      const name = e.target.value.trim()
      if (name) onUpdate((b) => ({ ...b, project: { ...b.project, name } }))
      else e.target.value = brief.project.name
    }} /></div>
    <p className="text-sm text-muted-foreground">{brief.project.clientName}<br />{brief.project.date} · {brief.project.times.join(', ')}</p>
    </SettingsSection>
    <SettingsSection value="add-cameras" title="Add camera points">
      <CameraAddPanel brief={brief} onAdd={onAddCamera} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
    <CamerasPanel selectedCameraIds={selectedCameraIds} onSelectCamera={onSelectCamera} onRemoveCameras={onRemoveCameras} brief={brief} selectedId={selectedId} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
    {brief.circleRig ? <>
      <Button variant="outline" onClick={() => onSelect(brief.circleRig!.id)}>Show rig handles</Button>
      {brief.circleRig.ovalRatio < 1 ? <RigRadii rig={brief.circleRig} /> : <NumberField label="Radius (m)" value={brief.circleRig.radiusMeters} min={0.1} max={10000} onChange={(radiusMeters) => onUpdate((b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters } }))} />}
      <Button variant="ghost" onClick={() => onUpdate((b) => ({ ...b, circleRig: null }))}>Remove rig</Button>
    </> : <Button variant="outline" onClick={onAddRig}>Add Circle Rig</Button>}
    </SettingsSection>
    </Accordion>
  </div>
}

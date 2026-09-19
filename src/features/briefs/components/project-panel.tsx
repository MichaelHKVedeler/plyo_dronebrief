import { useState } from 'react'
import { Circle, Crosshair } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cameraLabels, cameraTypes, type CameraAngle, type DroneBrief } from '../model/brief'
import { CameraAddPanel } from './camera-add-panel'
import { RigRadii } from './rig-radii'
import { RigRadiusFields } from './rig-radius-fields'
import { CameraGroups } from './camera-groups'
import { CamerasPanel } from './cameras-panel'
import { ShootTimes } from './shoot-times'
import type { BriefSession } from '../state/brief-session'

const editSections = ['project', 'rig', 'add-cameras', 'cameras']
const viewSections = ['project', 'rig', 'cameras', 'heights']

type Props = { onCenterCamera: (angle: CameraAngle) => void; onAddRig: () => void; selectedCameraIds: string[]; onSelectCamera: (id: string, range: boolean) => void; onRemoveCameras: (ids: string[]) => void; session: BriefSession; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void; selectedId: string | null; onSelect: (id: string | null) => void; onAddCamera: (type: CameraAngle['type']) => void }
export function ProjectPanel({ onCenterCamera, onAddRig, selectedCameraIds, onSelectCamera, onRemoveCameras, session, onUpdate, selectedId, onAddCamera }: Props) {
  const { brief, mode } = session
  const [open, setOpen] = useState<string[]>(mode === 'edit' ? editSections : viewSections)
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const selectedSection = selectedId ? (selectedId === brief.circleRig?.id ? 'rig' : 'cameras') : null
  if (lastSelected !== selectedId) {
    setLastSelected(selectedId)
    if (selectedSection) setOpen((previous) => previous.includes(selectedSection) ? previous : [...previous, selectedSection])
  }
  if (mode === 'view') return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="project" title="Project details">
    <dl className="grid gap-4">
      <div><dt className="text-muted-foreground">Project name</dt><dd className="mt-1 font-medium">{brief.project.name}</dd></div>
      <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1 font-medium">{brief.project.clientName}</dd></div>
    </dl>
    <ShootTimes brief={brief} />
    </SettingsSection>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
      {brief.circleRig ? <RigRadii rig={brief.circleRig} /> : <p>No circle rig in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
      {brief.angles.length ? <CameraGroups angles={brief.angles}>{(points) => points.map((angle, index) => <div key={angle.id} className="text-sm">
        <div className="flex items-center justify-between"><p className="font-medium">{index + 1}</p><Button variant="ghost" size="icon" aria-label={'Center on ' + cameraLabels[angle.type] + ' ' + (index + 1)} onClick={() => onCenterCamera(angle)}><Crosshair /></Button></div>
        <p className="text-muted-foreground">{angle.position.lat.toFixed(6)}, {angle.position.lng.toFixed(6)}{angle.type !== '360' && ' · ' + angle.directionDegrees.toFixed(1) + '°'}</p>
      </div>)}</CameraGroups> : <p>No camera points in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="heights" title="Camera settings">
    {cameraTypes.map((type) => <div key={type}><p className="font-medium">{cameraLabels[type]}</p><p className="mt-1 text-muted-foreground">{type === 'dslr' ? `${brief.typeSettings.dslr.angleCount} angles · ${brief.typeSettings.dslr.spacingDegrees}° spacing` : (brief.typeSettings[type].heightsMeters.join(', ') || 'None') + ' m'}</p></div>)}
    </SettingsSection>
  </Accordion>
  return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="project" title="Project details">
    <div className="grid gap-2"><Label htmlFor="edit-project-name">Project name</Label><Input key={brief.id + '-name'} id="edit-project-name" defaultValue={brief.project.name} maxLength={200} onBlur={(e) => {
      const name = e.target.value.trim()
      if (name) onUpdate((b) => ({ ...b, project: { ...b.project, name } }))
      else e.target.value = brief.project.name
    }} /></div>
    <div className="grid gap-2"><Label htmlFor="edit-client-name">Client name</Label><Input key={brief.id + '-client'} id="edit-client-name" defaultValue={brief.project.clientName} maxLength={200} onBlur={(e) => {
      const clientName = e.target.value.trim()
      if (clientName) onUpdate((b) => ({ ...b, project: { ...b.project, clientName } }))
      else e.target.value = brief.project.clientName
    }} /></div>
    <ShootTimes brief={brief} />
    </SettingsSection>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
    {brief.circleRig && <RigRadiusFields rig={brief.circleRig} onUpdate={onUpdate} />}
    {brief.circleRig
      ? <Button variant="ghost" onClick={() => onUpdate((b) => ({ ...b, circleRig: null }))}>Remove rig</Button>
      : <Button variant="outline" className="justify-start border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" onClick={onAddRig}><Circle />Add Circle Rig</Button>}
    </SettingsSection>
    <SettingsSection value="add-cameras" title="Add camera points">
      <CameraAddPanel brief={brief} onAdd={onAddCamera} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
    <CamerasPanel onCenterCamera={onCenterCamera} selectedCameraIds={selectedCameraIds} onSelectCamera={onSelectCamera} onRemoveCameras={onRemoveCameras} brief={brief} selectedId={selectedId} onUpdate={onUpdate} />
    </SettingsSection>
  </Accordion>
}

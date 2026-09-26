import { useState } from 'react'
import { Circle, Crosshair, Drone } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { Button } from '@/components/ui/button'
import { cameraLabels, cameraTypes, effectivePanoramaHeights, formatHeightsMeters, type CameraAngle, type DroneBrief } from '../model/brief'
import { CameraAddPanel } from './camera-add-panel'
import { cameraAppearance } from './camera-appearance'
import { RigRadii } from './rig-radii'
import { RigRadiusFields } from './rig-radius-fields'
import { DroneScanControls } from './drone-scan-controls'
import type { ScanRole } from '@/features/map/drone-scan'
import { CameraGroups } from './camera-groups'
import { CamerasPanel } from './cameras-panel'
import type { BriefSession } from '../state/brief-session'

const editSections = ['rig', 'add-cameras', 'drone-scan', 'cameras']
const viewSections = ['rig', 'cameras', 'drone-scan', 'heights']

type Props = { onCenterCamera: (angle: CameraAngle) => void; onAddRig: () => void; onAddScan: (role: ScanRole) => void; selectedCameraIds: string[]; onSelectCamera: (id: string, range: boolean) => void; onRemoveCameras: (ids: string[]) => void; session: BriefSession; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void; selectedId: string | null; onSelect: (id: string | null) => void; onAddCamera: (type: CameraAngle['type']) => void }
export function ProjectPanel({ onCenterCamera, onAddRig, onAddScan, selectedCameraIds, onSelectCamera, onRemoveCameras, session, onUpdate, selectedId, onAddCamera }: Props) {
  const { brief, mode } = session
  const [open, setOpen] = useState<string[]>(mode === 'edit' ? editSections : viewSections)
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const scanIds = [brief.droneScan?.highRes?.id, brief.droneScan?.lowRes?.id]
  const selectedSection = selectedId ? (selectedId === brief.circleRig?.id ? 'rig' : scanIds.includes(selectedId) ? 'drone-scan' : 'cameras') : null
  const scanCount = (brief.droneScan?.highRes ? 1 : 0) + (brief.droneScan?.lowRes ? 1 : 0)
  if (lastSelected !== selectedId) {
    setLastSelected(selectedId)
    if (selectedSection) setOpen((previous) => previous.includes(selectedSection) ? previous : [...previous, selectedSection])
  }
  if (mode === 'view') return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
      {brief.circleRig ? <RigRadii rig={brief.circleRig} /> : <p>No circle rig in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
      {brief.angles.length ? <CameraGroups angles={brief.angles}>{(points) => points.map((angle, index) => <div key={angle.id} className="text-sm">
        <div className="flex items-center justify-between"><p className="font-medium">{index + 1}</p><Button variant="ghost" size="icon" aria-label={'Center on ' + cameraLabels[angle.type] + ' ' + (index + 1)} onClick={() => onCenterCamera(angle)}><Crosshair /></Button></div>
        <p className="text-muted-foreground">{angle.position.lat.toFixed(6)}, {angle.position.lng.toFixed(6)}{angle.type !== '360' && angle.type !== 'extra-coverage' && ' · ' + angle.directionDegrees.toFixed(1) + '°'}</p>
        {angle.type === '360' && <p className="text-muted-foreground">{formatHeightsMeters(effectivePanoramaHeights(brief.typeSettings['360'].heightsMeters, angle)) || 'None'} m{angle.heightsMeters ? ' · override' : ''}</p>}
      </div>)}</CameraGroups> : <p>No camera points in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="drone-scan" title="Drone scan" count={scanCount}>
      <DroneScanControls brief={brief} editing={false} onAdd={onAddScan} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="heights" title="Camera settings">
    {cameraTypes.filter((type) => type !== 'extra-coverage').map((type) => <div key={type}><p className="font-medium">{cameraLabels[type]}</p><p className="mt-1 text-muted-foreground">{type === 'dslr' ? `${brief.typeSettings.dslr.angleCount} angles · ${brief.typeSettings.dslr.spacingDegrees}° spacing` : (brief.typeSettings[type].heightsMeters.join(', ') || 'None') + ' m'}</p></div>)}
    </SettingsSection>
  </Accordion>
  return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0}>
    {brief.circleRig && <RigRadiusFields rig={brief.circleRig} onUpdate={onUpdate} />}
    {brief.circleRig
      ? <Button variant="ghost" className="bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900 dark:hover:text-red-200" onClick={() => onUpdate((b) => ({ ...b, circleRig: null }))}>Remove rig</Button>
      : <Button variant="outline" className="justify-start border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900 dark:hover:text-emerald-200" onClick={onAddRig}><Circle />Add Circle Rig</Button>}
    </SettingsSection>
    <SettingsSection value="add-cameras" title="Add camera points">
      <CameraAddPanel brief={brief} onAdd={onAddCamera} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="drone-scan" title="Drone scan" count={scanCount}>
      <DroneScanControls brief={brief} editing onAdd={onAddScan} onUpdate={onUpdate} />
      <Button variant="outline" className={'w-full justify-start ' + cameraAppearance['extra-coverage'].className}
        disabled={brief.angles.length >= 1000} onClick={() => onAddCamera('extra-coverage')}>
        <Drone />Extra coverage
      </Button>
      <p className="text-xs text-muted-foreground">Uses Drone image heights. Shown with Drone scan in shared links.</p>
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
    <CamerasPanel onCenterCamera={onCenterCamera} selectedCameraIds={selectedCameraIds} onSelectCamera={onSelectCamera} onRemoveCameras={onRemoveCameras} brief={brief} selectedId={selectedId} onUpdate={onUpdate} />
    </SettingsSection>
  </Accordion>
}

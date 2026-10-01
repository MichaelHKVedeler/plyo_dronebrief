import { useState } from 'react'
import { Circle, Crosshair, Drone, X } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { Button } from '@/components/ui/button'
import { effectiveRigHeights, cameraLabels, cameraTypes, effectivePanoramaHeights, formatHeightsMeters, type CameraAngle, type DroneBrief, type LayerVisibility } from '../model/brief'
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

type Props = { placingType?: CameraAngle['type'] | null; onCenterCamera: (angle: CameraAngle) => void; onAddRig: () => void; onAddScan: (role: ScanRole) => void; selectedCameraIds: string[]; onSelectCamera: (id: string, range: boolean) => void; onRemoveCameras: (ids: string[]) => void; session: BriefSession; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void; onVisibilityChange: (layer: keyof LayerVisibility, visible: boolean) => void; selectedId: string | null; onSelect: (id: string | null) => void; onAddCamera: (type: CameraAngle['type']) => void }
export function ProjectPanel({ placingType, onCenterCamera, onAddRig, onAddScan, selectedCameraIds, onSelectCamera, onRemoveCameras, session, onUpdate, onVisibilityChange, selectedId, onAddCamera }: Props) {
  const { brief, mode } = session
  const [open, setOpen] = useState<string[]>(mode === 'edit' ? editSections : viewSections)
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const scanIds = [brief.droneScan?.highRes?.id, brief.droneScan?.lowRes?.id]
  const selectedSection = selectedId ? (selectedId === brief.circleRig?.id ? 'rig' : scanIds.includes(selectedId) ? 'drone-scan' : 'cameras') : null
  const scanCount = (brief.droneScan?.highRes ? 1 : 0) + (brief.droneScan?.lowRes ? 1 : 0)
  const visibility = (layer: keyof LayerVisibility) => ({ visible: session.visibility[layer], onToggle: () => onVisibilityChange(layer, !session.visibility[layer]) })
  if (lastSelected !== selectedId) {
    setLastSelected(selectedId)
    if (selectedSection) setOpen((previous) => previous.includes(selectedSection) ? previous : [...previous, selectedSection])
  }
  if (mode === 'view') return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0} visibility={visibility('circleRig')}>
      {brief.circleRig ? <><RigRadii rig={brief.circleRig} /><p className="text-sm">Heights: {formatHeightsMeters(effectiveRigHeights(brief)) || 'None'} m</p></> : <p>No circle rig in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
      {brief.angles.length ? <CameraGroups angles={brief.angles}>{(points) => points.map((angle, index) => <div key={angle.id} className="text-sm">
        <div className="flex items-center justify-between"><p className="font-medium">{index + 1}</p><Button variant="ghost" size="icon" aria-label={'Center on ' + cameraLabels[angle.type] + ' ' + (index + 1)} onClick={() => onCenterCamera(angle)}><Crosshair /></Button></div>
        <p className="text-muted-foreground">{angle.position.lat.toFixed(6)}, {angle.position.lng.toFixed(6)}{angle.type !== '360' && angle.type !== 'extra-coverage' && ' · ' + angle.directionDegrees.toFixed(1) + '°'}</p>
        {angle.type === '360' && <p className="text-muted-foreground">{formatHeightsMeters(effectivePanoramaHeights(brief.typeSettings['360'].heightsMeters, angle)) || 'None'} m{angle.heightsMeters ? ' · override' : ''}</p>}
      </div>)}</CameraGroups> : <p>No camera points in this brief.</p>}
    </SettingsSection>
    <SettingsSection value="drone-scan" title="Drone scan" count={scanCount} visibility={visibility('droneScan')}>
      <DroneScanControls brief={brief} editing={false} onAdd={onAddScan} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="heights" title="Camera settings" visibility={visibility('angles')}>
    {cameraTypes.filter((type) => type !== 'extra-coverage').map((type) => <div key={type}><p className="font-medium">{cameraLabels[type]}</p><p className="mt-1 text-muted-foreground">{type === 'dslr' ? `${brief.typeSettings.dslr.angleCount} angles · ${brief.typeSettings.dslr.spacingDegrees}° spacing` : (brief.typeSettings[type].heightsMeters.join(', ') || 'None') + ' m'}</p></div>)}
    </SettingsSection>
  </Accordion>
  return <Accordion type="multiple" value={open} onValueChange={setOpen}>
    <SettingsSection value="rig" title="Circle rig" count={brief.circleRig ? 1 : 0} visibility={visibility('circleRig')}>
    {brief.circleRig && <>
      <RigRadiusFields rig={brief.circleRig} heights={effectiveRigHeights(brief)} onUpdate={onUpdate} />
    </>}
    {brief.circleRig
      ? <Button variant="outline" aria-label="Remove Circle Rig" className="justify-start border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900 dark:hover:text-emerald-200" onClick={() => onUpdate((b) => ({ ...b, circleRig: null }))}>
        <X className="text-red-600 dark:text-red-400" />Circle Rig
      </Button>
      : <Button variant="outline" className="justify-start border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900 dark:hover:text-emerald-200" onClick={onAddRig}><Circle />Add Circle Rig</Button>}
    </SettingsSection>
    <SettingsSection value="add-cameras" title="Add camera points" visibility={visibility('angles')}>
      <CameraAddPanel placingType={placingType} brief={brief} onAdd={onAddCamera} onUpdate={onUpdate} />
    </SettingsSection>
    <SettingsSection value="drone-scan" title="Drone scan" count={scanCount} visibility={visibility('droneScan')}>
      <DroneScanControls brief={brief} editing onAdd={onAddScan} onUpdate={onUpdate} />
      <Button variant="outline" aria-pressed={placingType === 'extra-coverage'} className={'h-auto min-h-9 w-full justify-start whitespace-normal text-left ' + cameraAppearance['extra-coverage'].className + (placingType === 'extra-coverage' ? ' ring-2 ring-current ring-offset-2' : '')}
        disabled={brief.angles.length >= 1000} onClick={() => onAddCamera('extra-coverage')}>
        <Drone />{placingType === 'extra-coverage' ? 'Click in map to place' : 'Extra coverage'}
      </Button>
      {placingType === 'extra-coverage' && <p className="text-xs text-muted-foreground">Scroll to zoom. Shift-drag or middle-drag to pan. Right-click or Esc to stop.</p>}
      <p className="text-xs text-muted-foreground">Uses Drone image heights. Shown with Drone scan in shared links.</p>
    </SettingsSection>
    <SettingsSection value="cameras" title="Added camera points" count={brief.angles.length}>
    <CamerasPanel onCenterCamera={onCenterCamera} selectedCameraIds={selectedCameraIds} onSelectCamera={onSelectCamera} onRemoveCameras={onRemoveCameras} brief={brief} selectedId={selectedId} onUpdate={onUpdate} />
    </SettingsSection>
  </Accordion>
}

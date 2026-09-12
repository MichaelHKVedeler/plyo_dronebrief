import { numberedCameras } from '../model/camera-numbers'
import { cameraLabels } from '../model/brief'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import type { LayerVisibility } from '../model/brief'
import { ImageOverlayControls, type ImageControlsProps } from './image-overlay-controls'
import type { BriefSession } from '../state/brief-session'

export function LayersPanel({ session, onToggle, ...imageControls }: ImageControlsProps & { session: BriefSession; onToggle: (layer: keyof LayerVisibility, visible: boolean) => void }) {
  const { brief, visibility } = session
  const layers: { key: keyof LayerVisibility; label: string; count: number }[] = [
    { key: 'circleRig', label: 'Circle rig', count: brief.circleRig ? 1 : 0 },
    { key: 'angles', label: 'Camera angles', count: brief.angles.length },
    { key: 'polygons', label: 'Newbuild polygons', count: brief.polygons.length },
    { key: 'imageOverlays', label: 'Image overlays', count: brief.imageOverlays.length },
  ]
  return <div className="grid gap-5">
    {layers.map((layer) => <div className="flex items-center gap-3" key={layer.key}><Switch id={'layer-' + layer.key} checked={visibility[layer.key]} onCheckedChange={(checked) => onToggle(layer.key, checked)} /><Label htmlFor={'layer-' + layer.key} className="flex-1">{layer.label}</Label><Badge variant="secondary">{layer.count}</Badge></div>)}
    <Accordion type="multiple" defaultValue={session.mode === 'edit' ? ['contents'] : []}><SettingsSection value="contents" title="Scene contents"><div className="grid gap-3 text-sm">
      <ImageOverlayControls {...imageControls} overlays={brief.imageOverlays} editable={session.mode === 'edit'} />
      {visibility.circleRig && brief.circleRig && <p>Rig · {brief.circleRig.radiusMeters} m radius · {brief.circleRig.ovalRatio === 1 ? 'Circle' : 'Oval'}</p>}
      {visibility.angles && numberedCameras(brief.angles).map(({ angle, number }) => <p key={angle.id}>{cameraLabels[angle.type]} {number}</p>)}
      {visibility.polygons && brief.polygons.map((polygon) => <p key={polygon.id}>{polygon.label} · {polygon.vertices.length} vertices</p>)}

    </div></SettingsSection></Accordion>
  </div>
}

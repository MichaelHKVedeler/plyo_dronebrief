import { useState } from 'react'
import { Crosshair, Trash2, X } from 'lucide-react'
import { CameraGroups } from './camera-groups'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { Card, CardContent } from '@/components/ui/card'
import { cameraLabels, formatHeightsMeters, min360Fov, max360Fov, type CameraAngle, type DroneBrief } from '../model/brief'
import { HeightsField } from './heights-field'
import { cameraAppearance } from './camera-appearance'
import { CameraReorderHandle, type CameraDragPreview } from './camera-reorder-handle'
import { reorderCameras } from '../state/reorder-cameras'
import { NumberField } from './number-field'

type Props = {
  onCenterCamera: (angle: CameraAngle) => void
  selectedCameraIds: string[]
  onSelectCamera: (id: string, range: boolean) => void
  onRemoveCameras: (ids: string[]) => void
  brief: DroneBrief
  selectedId: string | null
  onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
}
export function CamerasPanel({ onCenterCamera, selectedCameraIds, onSelectCamera, onRemoveCameras, brief, selectedId, onUpdate }: Props) {
  const [dragPreview, setDragPreview] = useState<CameraDragPreview | null>(null)
  const selected = brief.angles.find((angle) => angle.id === selectedId)
  function remove(id: string) {
    onRemoveCameras(selectedCameraIds.includes(id) ? selectedCameraIds : [id])
  }
  function updateSelected(update: (angle: CameraAngle) => CameraAngle) {
    if (selected) onUpdate((b) => ({ ...b, angles: b.angles.map((angle) => angle.id === selected.id ? update(angle) : angle) }))
  }
  function updateAngle(id: string, update: (angle: CameraAngle) => CameraAngle) {
    onUpdate((b) => ({ ...b, angles: b.angles.map((angle) => angle.id === id ? update(angle) : angle) }))
  }
  return <div className="grid gap-3">
    {!brief.angles.length && <p className="text-sm text-muted-foreground">No camera points yet.</p>}
    <CameraGroups angles={brief.angles} selectedId={selectedId} onRemoveCameras={onRemoveCameras}>{(points) => <>
    {points.map((angle, index) => {
      const name = cameraLabels[angle.type] + ' ' + (index + 1)
      const Icon = cameraAppearance[angle.type].Icon
      const from = points.findIndex((point) => point.id === dragPreview?.source)
      const to = points.findIndex((point) => point.id === dragPreview?.target)
      const lifted = dragPreview?.source === angle.id
      const active = dragPreview && from >= 0 && !dragPreview.settling
      const swapTarget = active && index === to && !lifted
      return <div key={angle.id} data-camera-row={angle.id} className="relative">
        {swapTarget && <div aria-label={'Swap with ' + name} className="pointer-events-none absolute -inset-1 z-30 rounded-lg border-2 border-primary bg-primary/10" />}
        <div data-dragging={lifted && !dragPreview.settling ? 'true' : undefined}
        style={{ transform: lifted ? `translateY(${dragPreview.offset}px) scale(${!dragPreview.settling ? 1.025 : 1})` : undefined,
          transition: lifted && !dragPreview.settling ? 'box-shadow 120ms' : dragPreview ? 'transform 150ms ease, box-shadow 150ms ease' : 'none' }}
        className={'relative flex min-w-0 items-center gap-1 rounded-md motion-reduce:transition-none ' +
          (lifted ? 'z-20 bg-card/80 shadow-xl ring-2 ring-primary cursor-grabbing ' : '') +
          (dragPreview && !lifted ? 'pointer-events-none ' : '')}>
        <CameraReorderHandle onPreview={setDragPreview} angle={angle} name={name} points={points} onMove={(source, target) => onUpdate((brief) => reorderCameras(brief, source, target))} />
        <Button variant={selectedCameraIds.includes(angle.id) ? 'secondary' : 'ghost'} className={(angle.type === '360' ? 'shrink-0' : 'min-w-0 flex-1') + ' justify-start'}
          aria-label={name} aria-pressed={selectedCameraIds.includes(angle.id)} onClick={(event) => onSelectCamera(angle.id, event.shiftKey || event.ctrlKey)}><Icon /><Badge variant="secondary" className="size-5 shrink-0 justify-center rounded-full p-0" aria-hidden="true">{index + 1}</Badge></Button>
        {angle.type === '360' && <HeightsField id={'point-heights-' + angle.id} label={'Heights for ' + name + ' (m)'}
          className="h-8 w-auto min-w-16 flex-1 px-2" allowEmpty placeholder={formatHeightsMeters(brief.typeSettings['360'].heightsMeters)}
          value={angle.heightsMeters ?? []} onChange={(heightsMeters) => updateAngle(angle.id, (current) => {
            if (current.type !== '360') return current
            if (!heightsMeters.length) {
              const { heightsMeters: _removed, ...rest } = current
              return rest
            }
            return { ...current, heightsMeters }
          })} />}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={'Center on ' + name} title={'Center on ' + name} onClick={() => onCenterCamera(angle)}><Crosshair /></Button>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" aria-label={'Remove ' + name}
          title={selectedCameraIds.includes(angle.id) && selectedCameraIds.length > 1 ? 'Remove selected cameras' : 'Remove ' + name} onClick={() => remove(angle.id)}><X /></Button>
        </div>
      </div>
    })}
    {selected && points.some((angle) => angle.id === selected.id) && <Card className="py-4"><CardContent className="grid gap-4 px-3">
      <NumberField label="Camera latitude" value={selected.position.lat} min={-90} max={90} onChange={(lat) => updateSelected((angle) => ({ ...angle, position: { ...angle.position, lat } }))} />
      <NumberField label="Camera longitude" value={selected.position.lng} min={-180} max={180} onChange={(lng) => updateSelected((angle) => ({ ...angle, position: { ...angle.position, lng } }))} />
      {selected.type !== '360' && <NumberField label="Camera direction (degrees)" value={selected.directionDegrees} min={0} max={359.999999999}
        onChange={(directionDegrees) => updateSelected((angle) => angle.type === '360' ? angle : { ...angle, directionDegrees })} />}
      {selected.type === '360' && <>
        <p className="text-sm text-muted-foreground">Right-drag this point on the map. Drag farther to widen its focus, and around it to aim.</p>
        {selected.focus ? <>
          <NumberField label="Focus direction (degrees)" value={selected.focus.directionDegrees} min={0} max={359.999999999}
            onChange={(directionDegrees) => updateSelected((angle) => angle.type === '360' && angle.focus ? { ...angle, focus: { ...angle.focus, directionDegrees } } : angle)} />
          <NumberField label="Focus FOV (degrees)" value={selected.focus.fovDegrees} min={min360Fov} max={max360Fov}
            onChange={(fovDegrees) => updateSelected((angle) => angle.type === '360' && angle.focus ? { ...angle, focus: { ...angle.focus, fovDegrees } } : angle)} />
          <Button variant="outline" onClick={() => updateSelected((angle) => angle.type === '360' ? { ...angle, focus: undefined } : angle)}>Clear 360 focus</Button>
        </> : <Button variant="outline" onClick={() => updateSelected((angle) => angle.type === '360' ? { ...angle, focus: { directionDegrees: 0, fovDegrees: 90 } } : angle)}>Set 360 focus</Button>}
      </>}
      <Button variant="ghost" className="text-destructive" onClick={() => remove(selected.id)}><Trash2 /> Remove camera</Button>
    </CardContent></Card>}
    </>}</CameraGroups>
  </div>
}

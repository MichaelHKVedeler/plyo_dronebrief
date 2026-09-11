import { Crosshair, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cameraLabels, cameraTypes, type CameraAngle, type DroneBrief } from '../model/brief'
import { cameraAppearance } from './camera-appearance'
import { NumberField } from './number-field'

type Props = {
  selectedCameraIds: string[]
  onSelectCamera: (id: string, range: boolean) => void
  onRemoveCameras: (ids: string[]) => void
  brief: DroneBrief
  selectedId: string | null
  placing: boolean
  onAdd: (type: CameraAngle['type']) => void
  onSelect: (id: string | null) => void
  onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
}
export function CamerasPanel({ selectedCameraIds, onSelectCamera, onRemoveCameras, brief, selectedId, onAdd, onUpdate }: Props) {
  const selected = brief.angles.find((angle) => angle.id === selectedId)
  function remove(id: string) {
    onRemoveCameras(selectedCameraIds.includes(id) ? selectedCameraIds : [id])
  }
  function updateSelected(update: (angle: CameraAngle) => CameraAngle) {
    if (selected) onUpdate((b) => ({ ...b, angles: b.angles.map((angle) => angle.id === selected.id ? update(angle) : angle) }))
  }
  return <div className="grid gap-3">
    {cameraTypes.map((type) => {
      const Icon = cameraAppearance[type].Icon
      return <Button key={type} variant="outline" className="justify-start" disabled={brief.angles.length >= 1000}
        onClick={() => onAdd(type)}><Icon />{type === 'drone-image' ? 'Add drone image' : 'Add ' + cameraLabels[type] + ' point'}</Button>
    })}
    {brief.angles.map((angle) => {
      const Icon = cameraAppearance[angle.type].Icon
      return <div key={angle.id} className="flex min-w-0 items-center gap-1">
        <Button variant={selectedCameraIds.includes(angle.id) ? 'secondary' : 'ghost'} className="min-w-0 flex-1 justify-start"
          aria-pressed={selectedCameraIds.includes(angle.id)} onClick={(event) => onSelectCamera(angle.id, event.shiftKey || event.ctrlKey)}><Icon /><span className="truncate">{angle.label}</span><Crosshair className="ml-auto" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive" aria-label={'Remove ' + angle.label}
          title={selectedCameraIds.includes(angle.id) && selectedCameraIds.length > 1 ? 'Remove selected cameras' : 'Remove ' + angle.label} onClick={() => remove(angle.id)}><X /></Button>
      </div>
    })}
    {selected && <Card className="py-4"><CardContent className="grid gap-4 px-3">
      <div className="grid gap-2"><Label htmlFor="camera-label">Camera label</Label><Input id="camera-label" key={selected.id + selected.label}
        defaultValue={selected.label} maxLength={200} onBlur={(event) => {
          const label = event.target.value.trim()
          if (label) updateSelected((angle) => ({ ...angle, label }))
          else event.target.value = selected.label
        }} /></div>
      <NumberField label="Camera latitude" value={selected.position.lat} min={-90} max={90} onChange={(lat) => updateSelected((angle) => ({ ...angle, position: { ...angle.position, lat } }))} />
      <NumberField label="Camera longitude" value={selected.position.lng} min={-180} max={180} onChange={(lng) => updateSelected((angle) => ({ ...angle, position: { ...angle.position, lng } }))} />
      {selected.type !== '360' ? <NumberField label="Camera direction (degrees)" value={selected.directionDegrees} min={0} max={359.999999999}
        onChange={(directionDegrees) => updateSelected((angle) => angle.type === '360' ? angle : { ...angle, directionDegrees })} />
        : <p className="text-sm text-muted-foreground">360 points have a position only.</p>}
      <Button variant="ghost" className="text-destructive" onClick={() => remove(selected.id)}><Trash2 /> Remove camera</Button>
    </CardContent></Card>}
  </div>
}

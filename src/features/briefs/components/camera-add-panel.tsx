import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cameraTypes, cameraLabels, type CameraAngle, type DroneBrief } from '../model/brief'
import { cameraAppearance } from './camera-appearance'

export function CameraAddPanel({ brief, onAdd, onUpdate }: { brief: DroneBrief; onAdd: (type: CameraAngle['type']) => void; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void }) {
  return <div className="grid gap-5">
    {cameraTypes.map((type) => {
      const Icon = cameraAppearance[type].Icon
      return <div className="grid gap-2" key={type}>
      <Button variant="outline" className="justify-start" disabled={brief.angles.length >= 1000} onClick={() => onAdd(type)}>
        <Icon />{type === 'drone-image' ? 'Add drone image' : 'Add ' + cameraLabels[type] + ' point'}
      </Button>
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
    </div>
    })}
    <p className="text-sm text-muted-foreground">Separate multiple heights with commas. Fields save when you leave them.</p>
  </div>
}

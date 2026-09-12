import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cameraTypes, cameraLabels, maxDslrAngles, maxDslrSpacing, minDslrSpacing, type CameraAngle, type DroneBrief } from '../model/brief'
import { cameraAppearance } from './camera-appearance'
import { NumberField } from './number-field'

export function CameraAddPanel({ brief, onAdd, onUpdate }: { brief: DroneBrief; onAdd: (type: CameraAngle['type']) => void; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void }) {
  return <div className="grid gap-5">
    {cameraTypes.map((type) => {
      const Icon = cameraAppearance[type].Icon
      return <div className="grid gap-2" key={type}>
      <Button variant="outline" className={'justify-start ' + cameraAppearance[type].className} disabled={brief.angles.length >= 1000} onClick={() => onAdd(type)}>
        <Icon />{type === 'drone-image' ? 'Add drone image' : 'Add ' + cameraLabels[type] + ' point'}
      </Button>
      <div className="ml-4 grid gap-2 border-l-2 border-current/15 py-1 pl-3">
      {type === 'dslr' ? <div className="grid grid-cols-2 items-start gap-3">
        <NumberField label="Number of angles" value={brief.typeSettings.dslr.angleCount} min={1} max={maxDslrAngles} step={1} live
          onChange={(angleCount) => onUpdate((b) => ({ ...b, typeSettings: { ...b.typeSettings, dslr: {
            ...b.typeSettings.dslr, angleCount, spacingDegrees: Math.min(b.typeSettings.dslr.spacingDegrees, maxDslrSpacing(angleCount)),
          } } }))} />
        <NumberField label="Spacing (°)" value={brief.typeSettings.dslr.spacingDegrees} min={minDslrSpacing} max={maxDslrSpacing(brief.typeSettings.dslr.angleCount)} step={1} live
          onChange={(spacingDegrees) => onUpdate((b) => ({ ...b, typeSettings: { ...b.typeSettings, dslr: { ...b.typeSettings.dslr, spacingDegrees } } }))} />
      </div> : <>
      <Label htmlFor={'heights-' + type}>{cameraLabels[type]} heights (m)</Label>
      <Input id={'heights-' + type} defaultValue={brief.typeSettings[type].heightsMeters.join(', ')} onBlur={(event) => {
        const text = event.target.value.trim()
        const tokens = text.split(',').map((item) => item.trim())
        const heightsMeters = text ? tokens.map((item) => item ? Number(item) : NaN) : []
        if (heightsMeters.length > 50 || heightsMeters.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) {
          event.target.value = brief.typeSettings[type].heightsMeters.join(', '); return
        }
        onUpdate((b) => ({ ...b, typeSettings: { ...b.typeSettings, [type]: { ...b.typeSettings[type], heightsMeters } } }))
      }} />
      </>}
      </div>
    </div>
    })}
  </div>
}

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cameraTypes, cameraLabels, floorHeightMeters, maxDslrAngles, maxDslrSpacing, minDslrSpacing, next360FloorHeight, type CameraAngle, type DroneBrief } from '../model/brief'
import { cameraAppearance } from './camera-appearance'
import { HeightsField } from './heights-field'
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
      <div className="flex items-center gap-2">
      <HeightsField id={'heights-' + type} value={brief.typeSettings[type].heightsMeters} onChange={(heightsMeters) =>
        onUpdate((b) => ({ ...b, typeSettings: { ...b.typeSettings, [type]: { ...b.typeSettings[type], heightsMeters } } }))} />
      {type === '360' && <Button type="button" size="sm" variant="outline" className="shrink-0"
        disabled={brief.typeSettings['360'].heightsMeters.length >= 50 || next360FloorHeight(brief.typeSettings['360'].heightsMeters) > 10000}
        onClick={() => onUpdate((b) => {
          const heightsMeters = b.typeSettings['360'].heightsMeters
          const next = next360FloorHeight(heightsMeters)
          if (heightsMeters.length >= 50 || next > 10000) return b
          return { ...b, typeSettings: { ...b.typeSettings, '360': { ...b.typeSettings['360'], heightsMeters: [...heightsMeters, next] } } }
        })}>Add floor ({floorHeightMeters}m)</Button>}
      </div>
      </>}
      </div>
    </div>
    })}
  </div>
}

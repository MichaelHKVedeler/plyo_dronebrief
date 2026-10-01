import { defaultRigArrowCount, maxRigArrows, type DroneBrief } from '../model/brief'
import { Label } from '@/components/ui/label'
import { HeightsField } from './heights-field'
import { NumberField } from './number-field'

export function RigRadiusFields({ rig, heights, onUpdate }: { rig: NonNullable<DroneBrief['circleRig']>; heights: number[]; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void }) {
  const oval = rig.ovalRatio < 1
  const minor = rig.radiusMeters * rig.ovalRatio
  return <div className="grid gap-3">
    <div className={oval ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
      <NumberField label={oval ? 'Biggest radius (m)' : 'Radius (m)'} value={Math.ceil(rig.radiusMeters)}
        min={oval ? Math.max(1, Math.ceil(minor)) : 1} max={oval ? Math.min(10000, Math.ceil(minor * 10)) : 10000} step={1} live resetKey={rig.id}
        onChange={(radiusMeters) => onUpdate((brief) => {
          const current = brief.circleRig
          if (!current || current.id !== rig.id) return brief
          const ovalRatio = current.ovalRatio === 1 ? 1 : Math.max(0.1, Math.min(1, current.radiusMeters * current.ovalRatio / radiusMeters))
          return { ...brief, circleRig: { ...current, radiusMeters, ovalRatio } }
        })} />
      {oval && <NumberField label="Smallest radius (m)" value={Math.ceil(minor)} min={Math.ceil(rig.radiusMeters * 0.1)} max={Math.ceil(rig.radiusMeters)} step={1} live resetValue={Math.ceil(rig.radiusMeters)} resetKey={rig.id}
        onChange={(radiusMeters) => onUpdate((brief) => {
          const current = brief.circleRig
          if (!current || current.id !== rig.id) return brief
          return { ...brief, circleRig: { ...current, ovalRatio: Math.max(0.1, Math.min(1, radiusMeters / current.radiusMeters)) } }
        })} />}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Number of arrows" value={rig.arrowCount} min={1} max={maxRigArrows} step={1} live resetValue={defaultRigArrowCount} resetKey={rig.id}
        onChange={(arrowCount) => onUpdate((brief) => {
          const current = brief.circleRig
          return current?.id === rig.id ? { ...brief, circleRig: { ...current, arrowCount } } : brief
        })} />
      <div className="grid min-w-0 gap-2">
        <Label htmlFor="circle-rig-heights">Circle rig heights (m)</Label>
        <HeightsField id="circle-rig-heights" value={heights} onChange={(heightsMeters) => onUpdate((brief) => {
          const current = brief.circleRig
          return current?.id === rig.id ? { ...brief, circleRig: { ...current, heightsMeters } } : brief
        })} />
      </div>
    </div>
  </div>
}


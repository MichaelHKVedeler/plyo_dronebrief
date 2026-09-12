import { maxRigArrows, type DroneBrief } from '../model/brief'
import { NumberField } from './number-field'

export function RigRadiusFields({ rig, onUpdate }: { rig: NonNullable<DroneBrief['circleRig']>; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void }) {
  const oval = rig.ovalRatio < 1
  const minor = rig.radiusMeters * rig.ovalRatio
  return <div className={oval ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
    <NumberField label={oval ? 'Biggest radius (m)' : 'Radius (m)'} value={rig.radiusMeters}
      min={oval ? Math.max(0.1, minor) : 0.1} max={oval ? Math.min(10000, minor * 10) : 10000} step={0.1} live
      onChange={(radiusMeters) => onUpdate((brief) => {
        const current = brief.circleRig
        if (!current || current.id !== rig.id) return brief
        const ovalRatio = current.ovalRatio === 1 ? 1 : Math.max(0.1, Math.min(1, current.radiusMeters * current.ovalRatio / radiusMeters))
        return { ...brief, circleRig: { ...current, radiusMeters, ovalRatio } }
      })} />
    {oval && <NumberField label="Smallest radius (m)" value={minor} min={rig.radiusMeters * 0.1} max={rig.radiusMeters} step={0.1} live
      onChange={(radiusMeters) => onUpdate((brief) => {
        const current = brief.circleRig
        if (!current || current.id !== rig.id) return brief
        return { ...brief, circleRig: { ...current, ovalRatio: Math.max(0.1, Math.min(1, radiusMeters / current.radiusMeters)) } }
      })} />}
    <NumberField label="Number of arrows" value={rig.arrowCount} min={1} max={maxRigArrows} step={1} live
      onChange={(arrowCount) => onUpdate((brief) => {
        const current = brief.circleRig
        return current?.id === rig.id ? { ...brief, circleRig: { ...current, arrowCount } } : brief
      })} />
  </div>
}


import type { DroneBrief } from '../model/brief'

export function RigRadii({ rig }: { rig: NonNullable<DroneBrief['circleRig']> }) {
  return <dl className="grid gap-2 text-sm">
    {rig.ovalRatio < 1 && <div><dt className="text-muted-foreground">Smallest radius</dt><dd>{(rig.radiusMeters * rig.ovalRatio).toFixed(1)} m</dd></div>}
    <div><dt className="text-muted-foreground">{rig.ovalRatio < 1 ? 'Biggest radius' : 'Radius'}</dt><dd>{rig.radiusMeters.toFixed(1)} m</dd></div>
  </dl>
}

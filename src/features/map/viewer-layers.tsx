import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'

export function ViewerLayers({ session, dispatch }: { session: BriefSession; dispatch: (action: BriefAction) => void }) {
  const id = useId()
  return <div className="pointer-events-auto grid w-fit gap-1 rounded-lg border bg-card p-2 shadow-sm" aria-label="Map layers">
    {([{ key: 'circleRig', label: 'Circle rig' }, { key: 'angles', label: 'Additional angles' }, { key: 'imageOverlays', label: 'Image overlays' }] as const).map(({ key, label }) =>
      <Label key={key} htmlFor={id + key} className="cursor-pointer gap-2 py-1">
        <Switch id={id + key} checked={session.visibility[key]} onCheckedChange={(visible) => dispatch({ type: 'visibility', layer: key, visible })} />{label}
      </Label>)}
  </div>
}

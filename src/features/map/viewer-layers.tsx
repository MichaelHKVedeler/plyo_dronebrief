import { ShieldBan } from 'lucide-react'
import { FloorplanIcon } from './floorplan-icon'
import { LayerToggleButton } from '@/features/briefs/components/briefing-map-layers'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CaptureKindGlyph } from '@/features/briefs/components/capture-kind-glyph'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'

export function ViewerLayers({ session, dispatch }: { session: BriefSession; dispatch: (action: BriefAction) => void }) {
  const layers = [
    { key: 'circleRig', label: 'Circle rig', kind: 'circleRig' },
    { key: 'droneScan', label: 'Drone scan', kind: 'droneScan' },
    { key: 'angles', label: 'Camera points', kind: 'dslr' },
  ] as const
  return <div className="pointer-events-auto grid w-fit justify-items-center gap-2.5 rounded-lg border bg-card p-2 shadow-sm" aria-label="Map layers">
    {layers.map(({ key, label, kind }) => {
      const visible = session.visibility[key]
      const action = visible ? `Hide ${label}` : `Show ${label}`
      return <Button key={key} type="button" variant="ghost" size="icon-sm"
        className={`rounded-full p-0 hover:bg-transparent ${visible ? '' : 'opacity-50'}`}
        aria-pressed={visible} aria-label={action} title={action}
        onClick={() => dispatch({ type: 'visibility', layer: key, visible: !visible })}>
        <CaptureKindGlyph kind={kind} />
      </Button>
    })}
    <Separator />
    <LayerToggleButton icon={FloorplanIcon} visible={session.visibility.imageOverlays} showLabel="Show Floor plan" hideLabel="Hide Floor plan"
      onToggle={() => dispatch({ type: 'visibility', layer: 'imageOverlays', visible: !session.visibility.imageOverlays })} />
    <LayerToggleButton icon={ShieldBan} visible={session.visibility.droneZones} showLabel="Show no-fly zones" hideLabel="Hide no-fly zones"
      onToggle={() => dispatch({ type: 'visibility', layer: 'droneZones', visible: !session.visibility.droneZones })} />
  </div>
}

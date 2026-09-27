import { ImageOff, LayoutGrid } from 'lucide-react'
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
    <Button type="button" variant="ghost" size="icon-sm"
      className={`rounded-full p-0 hover:bg-transparent ${session.visibility.imageOverlays ? '' : 'opacity-50'}`}
      aria-pressed={session.visibility.imageOverlays}
      aria-label={session.visibility.imageOverlays ? 'Hide Floor plan' : 'Show Floor plan'}
      title={session.visibility.imageOverlays ? 'Hide Floor plan' : 'Show Floor plan'}
      onClick={() => dispatch({ type: 'visibility', layer: 'imageOverlays', visible: !session.visibility.imageOverlays })}>
      <span aria-hidden className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${session.visibility.imageOverlays ? 'border-foreground bg-background text-foreground' : 'border-dashed border-muted-foreground/70 bg-muted text-muted-foreground'}`}>
        {session.visibility.imageOverlays ? <LayoutGrid className="size-4" /> : <ImageOff className="size-4" />}
      </span>
    </Button>
  </div>
}

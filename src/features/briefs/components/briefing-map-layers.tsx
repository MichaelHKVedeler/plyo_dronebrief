import { ImageOff, LayoutGrid } from 'lucide-react'
import type { DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { toggleIsolatedCapture, type IsolatedCapture } from '@/features/map/isolated-capture'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { briefingCopy } from './briefing-copy'
import { captureInstructions } from './capture-instructions'
import { CaptureKindIsolateButton } from './capture-kind-glyph'

function FloorplanToggleButton({ visible, showLabel, hideLabel, onToggle }: {
  visible: boolean
  showLabel: string
  hideLabel: string
  onToggle: () => void
}) {
  const Icon = visible ? LayoutGrid : ImageOff
  return <Button type="button" variant="ghost" size="icon-sm"
    className={`rounded-full p-0 hover:bg-transparent ${visible ? 'ring-2 ring-ring' : 'opacity-50'}`}
    aria-pressed={visible} aria-label={visible ? hideLabel : showLabel} title={visible ? hideLabel : showLabel} onClick={onToggle}>
    <span aria-hidden className={'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm '
      + (visible ? 'border-foreground bg-background text-foreground' : 'border-dashed border-muted-foreground/70 bg-muted text-muted-foreground')}>
      <Icon className="size-4" />
    </span>
  </Button>
}

export function BriefingMapLayers({ brief, language, isolatedKind, onIsolate, floorplanVisible = true, onFloorplanVisible }: {
  brief: DroneBrief
  language: PdfLanguage
  isolatedKind: IsolatedCapture
  onIsolate: (kind: IsolatedCapture) => void
  floorplanVisible?: boolean
  onFloorplanVisible?: (visible: boolean) => void
}) {
  const rows = captureInstructions(brief, language)
  const copy = briefingCopy[language]
  const hasFloorplan = brief.imageOverlays.length > 0
  if (!rows.length && !hasFloorplan) return null
  return <div className="pointer-events-auto grid w-fit justify-items-center gap-2.5 rounded-lg border bg-card p-2 shadow-sm">
    {rows.map((row) => <CaptureKindIsolateButton key={row.key} kind={row.key} label={row.label} pressed={isolatedKind === row.key}
      onClick={() => onIsolate(toggleIsolatedCapture(isolatedKind, row.key))} />)}
    {hasFloorplan && onFloorplanVisible && <>
      {rows.length > 0 && <Separator />}
      <FloorplanToggleButton visible={floorplanVisible} showLabel={copy.showFloorplan} hideLabel={copy.hideFloorplan}
        onToggle={() => onFloorplanVisible(!floorplanVisible)} />
    </>}
  </div>
}

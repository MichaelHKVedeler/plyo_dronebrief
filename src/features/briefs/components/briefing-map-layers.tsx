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
    className={`rounded-full p-0 hover:bg-transparent ${visible ? '' : 'opacity-50'}`}
    aria-pressed={visible} aria-label={visible ? hideLabel : showLabel} title={visible ? hideLabel : showLabel} onClick={onToggle}>
    <span aria-hidden className={'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm '
      + (visible ? 'border-foreground bg-background text-foreground' : 'border-dashed border-muted-foreground/70 bg-muted text-muted-foreground')}>
      <Icon className="size-4" />
    </span>
  </Button>
}

export function BriefingMapLayers({ brief, language, isolatedKind, onIsolate, scanSplit = false, floorplanVisible = true, onFloorplanVisible }: {
  brief: DroneBrief
  language: PdfLanguage
  isolatedKind: IsolatedCapture
  onIsolate: (kind: IsolatedCapture) => void
  /** Drone scan links isolate the circles and the extra coverage points separately. */
  scanSplit?: boolean
  floorplanVisible?: boolean
  onFloorplanVisible?: (visible: boolean) => void
}) {
  const rows = captureInstructions(brief, language).filter((row) => row.key !== 'extra-coverage')
  const copy = briefingCopy[language]
  const hasFloorplan = brief.imageOverlays.length > 0
  const hasCircles = !!(brief.droneScan?.highRes || brief.droneScan?.lowRes)
  const hasExtra = brief.angles.some((angle) => angle.type === 'extra-coverage')
  const hasScan = !scanSplit && (hasCircles || hasExtra)
  const splitKinds = scanSplit ? ([hasCircles && 'droneScan', hasExtra && 'extra-coverage'] as const).filter((kind) => kind !== false) : []
  if (!rows.length && !hasFloorplan && !hasScan && !splitKinds.length) return null
  return <div className="pointer-events-auto grid w-fit justify-items-center gap-2.5 rounded-lg border bg-card p-2 shadow-sm">
    {rows.map((row) => <CaptureKindIsolateButton key={row.key} kind={row.key} label={row.label} pressed={isolatedKind === row.key}
      dimmed={isolatedKind !== null && isolatedKind !== row.key}
      onClick={() => onIsolate(toggleIsolatedCapture(isolatedKind, row.key))} />)}
    {hasScan && <CaptureKindIsolateButton kind="droneScan" label={copy.droneScan} pressed={isolatedKind === 'droneScan'}
      dimmed={isolatedKind !== null && isolatedKind !== 'droneScan'}
      onClick={() => onIsolate(toggleIsolatedCapture(isolatedKind, 'droneScan'))} />}
    {splitKinds.map((kind) => <CaptureKindIsolateButton key={kind} kind={kind} label={kind === 'droneScan' ? copy.droneScan : copy.extraCoverage} pressed={isolatedKind === kind}
      dimmed={isolatedKind !== null && isolatedKind !== kind}
      onClick={() => onIsolate(toggleIsolatedCapture(isolatedKind, kind))} />)}
    {hasFloorplan && onFloorplanVisible && <>
      {rows.length > 0 && <Separator />}
      <FloorplanToggleButton visible={floorplanVisible} showLabel={copy.showFloorplan} hideLabel={copy.hideFloorplan}
        onToggle={() => onFloorplanVisible(!floorplanVisible)} />
    </>}
  </div>
}

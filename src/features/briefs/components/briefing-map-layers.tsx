import type { ComponentType } from 'react'
import { ShieldBan } from 'lucide-react'
import { FloorplanIcon } from '@/features/map/floorplan-icon'
import type { DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { briefingCopy } from './briefing-copy'
import { captureInstructions, type CaptureToggleKey } from './capture-instructions'
import { CaptureKindToggleButton, type CaptureKind } from './capture-kind-glyph'

export function LayerToggleButton({ visible, showLabel, hideLabel, onToggle, icon: Icon }: {
  visible: boolean
  showLabel: string
  hideLabel: string
  onToggle: () => void
  icon: ComponentType<{ className?: string }>
}) {
  return <Button type="button" variant="ghost" size="icon-sm"
    className={`rounded-full p-0 hover:bg-transparent ${visible ? '' : 'opacity-50'}`}
    aria-pressed={visible} aria-label={visible ? hideLabel : showLabel} title={visible ? hideLabel : showLabel} onClick={onToggle}>
    <span aria-hidden className={'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm '
      + (visible ? 'border-foreground bg-background text-foreground' : 'border-dashed border-muted-foreground/70 bg-muted text-muted-foreground')}>
      <Icon className="size-4" />
    </span>
  </Button>
}

export function BriefingMapLayers({ brief, language, hiddenKinds, onHiddenKinds, scanSplit = false, floorplanVisible = true, onFloorplanVisible, zonesVisible = true, onZonesVisible }: {
  brief: DroneBrief
  language: PdfLanguage
  hiddenKinds: ReadonlySet<CaptureToggleKey>
  onHiddenKinds: (kinds: ReadonlySet<CaptureToggleKey>) => void
  /** Drone scan links hide the circles and the extra coverage points separately. */
  scanSplit?: boolean
  floorplanVisible?: boolean
  onFloorplanVisible?: (visible: boolean) => void
  zonesVisible?: boolean
  onZonesVisible?: (visible: boolean) => void
}) {
  const rows = captureInstructions(brief, language).filter((row) => row.key !== 'extra-coverage')
  const copy = briefingCopy[language]
  const hasFloorplan = brief.imageOverlays.length > 0
  const hasCircles = !!(brief.droneScan?.highRes || brief.droneScan?.lowRes)
  const hasExtra = brief.angles.some((angle) => angle.type === 'extra-coverage')
  const hasScan = !scanSplit && (hasCircles || hasExtra)
  const splitKinds = scanSplit ? ([hasCircles && 'droneScan', hasExtra && 'extra-coverage'] as const).filter((kind) => kind !== false) : []
  function toggle(label: string, kind: CaptureKind, key: CaptureToggleKey = kind, together: CaptureToggleKey[] = [key], number?: number) {
    const visible = !hiddenKinds.has(key)
    return <CaptureKindToggleButton key={key} kind={kind} number={number} visible={visible} label={`${visible ? copy.hide : copy.show} ${label}`}
      onClick={() => {
        const next = new Set(hiddenKinds)
        for (const each of together) if (visible) next.add(each); else next.delete(each)
        onHiddenKinds(next)
      }} />
  }
  if (!rows.length && !hasFloorplan && !hasScan && !splitKinds.length && !onZonesVisible) return null
  return <div className="pointer-events-auto grid w-fit justify-items-center gap-2.5 rounded-lg border bg-card p-2 shadow-sm">
    {rows.map((row) => toggle(row.label, row.key, row.toggleKey, undefined, row.number))}
    {hasScan && toggle(copy.droneScan, 'droneScan', 'droneScan', ['droneScan', 'extra-coverage'])}
    {splitKinds.map((kind) => toggle(kind === 'droneScan' ? copy.droneScan : copy.extraCoverage, kind))}
    {hasFloorplan && onFloorplanVisible && <>
      {rows.length > 0 && <Separator />}
      <LayerToggleButton icon={FloorplanIcon} visible={floorplanVisible} showLabel={copy.showFloorplan} hideLabel={copy.hideFloorplan}
        onToggle={() => onFloorplanVisible(!floorplanVisible)} />
    </>}
    {onZonesVisible && <>
      {(rows.length > 0 || hasFloorplan) && <Separator />}
      <LayerToggleButton icon={ShieldBan} visible={zonesVisible} showLabel={copy.showZones} hideLabel={copy.hideZones}
        onToggle={() => onZonesVisible(!zonesVisible)} />
    </>}
  </div>
}

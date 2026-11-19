import { useState, type ComponentType, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ShieldBan } from 'lucide-react'
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

export function BriefingMapLayers({ brief, language, sliders, hiddenKinds, onHiddenKinds, scanSplit = false, floorplanVisible = true, onFloorplanVisible, zonesVisible = true, onZonesVisible }: {
  brief: DroneBrief
  language: PdfLanguage
  /** Icon size and dimming sliders, collapsed together with the layer buttons. */
  sliders?: ReactNode
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
  const [collapsed, setCollapsed] = useState(false)
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
  if (!sliders && !rows.length && !hasFloorplan && !hasScan && !splitKinds.length && !onZonesVisible) return null
  const collapseLabel = collapsed ? copy.showLayerButtons : copy.hideLayerButtons
  // A full-height bar on the left edge; buttons keep their size and the sliders shrink so it fits any height.
  // Collapsed, only the arrow remains, in the same spot, out of the layout flow.
  // Every button's hit area runs from the screen edge to about 1.5rem past the bar so either thumb can reach it.
  // shortcut: no scrolling, so a very short screen could cut off the lowest buttons; add overflow handling if that shows up.
  return <div data-layer-sidebar={collapsed ? 'closed' : 'open'} className={(collapsed ? 'absolute top-0 left-0 rounded-br-lg border-r border-b bg-card p-2 shadow-sm'
    : 'flex h-full w-fit flex-col items-center gap-2.5 border-r bg-card p-2 shadow-sm [&>*]:shrink-0')
    + ' pointer-events-auto [&_button]:relative [&_button]:after:absolute [&_button]:after:-inset-y-1 [&_button]:after:-left-4 [&_button]:after:-right-9'}>
    <Button type="button" variant="ghost" size="icon-lg" className="[&_svg]:size-6" aria-expanded={!collapsed} aria-label={collapseLabel} title={collapseLabel}
      onClick={() => setCollapsed(!collapsed)}>
      {collapsed ? <ChevronRight /> : <ChevronLeft />}
    </Button>
    {!collapsed && <>
    {rows.length > 0 && <Separator />}
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
    {sliders && <><Separator /><div className="flex min-h-0 !shrink flex-col items-center gap-2.5">{sliders}</div></>}
    </>}
  </div>
}

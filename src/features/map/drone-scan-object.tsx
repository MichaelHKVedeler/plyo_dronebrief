import { DroneScanEditing } from '@/features/briefs/state/drone-scan-editing'
import { useContext, useState } from 'react'
import { Circle } from 'lucide-react'
import type { DroneBrief, Position, ScanCircle } from '@/features/briefs/model/brief'
import { destination, metersPerPixel } from './geometry'
import { useObjectRenderer } from './object-renderer'
import { MapHandle } from './map-handle'
import { MapObjectScale } from './map-object-scale'
import { RigLineDragController } from './rig-line-drag-controller'
import { useHoverHandles } from './use-hover-handles'
import {
  applyScanDiameter, circleOutline, diameterBand, droneScanColor, droneScanFillOpacity, formatScanDiameter,
  moveScanCircles, scaleScanCircle, scanAsRig, scanDiameterStep, scanGapMeters, scanHandleHitSize, scanOutlineHitRadius, snapScanDiameter, type ScanRole,
} from './drone-scan'

type Scan = NonNullable<DroneBrief['droneScan']>
type Props = {
  scan: Scan
  zoom: number
  editable: boolean
  interactive: boolean
  onSelect: (id: string) => void
  onCommit: (scan: Scan) => void
}

export function DroneScanObject({ scan, zoom, editable, interactive, onSelect, onCommit }: Props) {
  const { Marker: AdvancedMarker, Polygon } = useObjectRenderer()
  const { locked } = useContext(DroneScanEditing)
  const [draft, setDraft] = useState<{ id: string; source: Scan; scan: Scan } | null>(null)
  const visible = draft?.source === scan ? draft.scan : scan
  const high = visible.highRes
  const low = visible.lowRes
  const canEdit = editable && interactive
  const highHover = useHoverHandles(!canEdit, 0)
  const lowHover = useHoverHandles(!canEdit, 0)
  const highControl = useHoverHandles(!canEdit, 0)
  const lowControl = useHoverHandles(!canEdit, 0)
  function cancel() {
    setDraft(null)
    highHover.leave()
    lowHover.leave()
    highControl.leave()
    lowControl.leave()
  }
  function commit(role: ScanRole, circle: ScanCircle) {
    cancel()
    if (!canEdit) return
    onCommit({ ...scan, highRes: role === 'high' ? circle : scan.highRes, lowRes: role === 'low' ? circle : scan.lowRes })
  }
  function preview(source: ScanCircle, circle: ScanCircle) {
    if (canEdit) setDraft({ id: source.id, source: scan, scan: { ...scan, highRes: source.id === scan.highRes?.id ? circle : scan.highRes, lowRes: source.id === scan.lowRes?.id ? circle : scan.lowRes } })
  }
  function previewMove(source: ScanCircle, circle: ScanCircle) {
    const role = source.id === scan.highRes?.id ? 'high' : 'low'
    if (canEdit) setDraft({ id: source.id, source: scan, scan: moveScanCircles(scan, role, circle.position, locked, scanGapMeters(source.position.lat, zoom)) })
  }
  function commitMove(role: ScanRole, circle: ScanCircle) {
    cancel()
    if (canEdit) onCommit(moveScanCircles(scan, role, circle.position, locked, scanGapMeters(circle.position.lat, zoom)))
  }
  return <>
    {scan.highRes && high && <ScanDrag circle={high} source={scan.highRes} role="high" canEdit={canEdit}
      hover={highHover} onSelect={() => onSelect(scan.highRes!.id)} onPreview={previewMove} onCommit={commitMove} onCancel={cancel} />}
    {scan.lowRes && low && <ScanDrag circle={low} source={scan.lowRes} role="low" canEdit={canEdit}
      hover={lowHover} onSelect={() => onSelect(scan.lowRes!.id)} onPreview={previewMove} onCommit={commitMove} onCancel={cancel} />}
    {low && <ScanShape active={canEdit && (lowHover.hovered || lowControl.hovered || draft !== null)} circle={low} hole={high} pixelsToMeters={metersPerPixel(low.position.lat, zoom)} Polygon={Polygon} Marker={AdvancedMarker} role="low" />}
    {high && <ScanShape active={canEdit && (highHover.hovered || highControl.hovered || draft !== null)} circle={high} hole={null} pixelsToMeters={metersPerPixel(high.position.lat, zoom)} Polygon={Polygon} Marker={AdvancedMarker} role="high" />}
    {scan.highRes && high && <ScanScale circle={high} source={scan.highRes} role="high" partner={scan.lowRes} zoom={zoom} canEdit={canEdit}
      active={highHover.hovered || highControl.hovered || draft?.id === scan.highRes.id} hover={highControl} onSelect={() => onSelect(scan.highRes!.id)} onPreview={preview} onCommit={commit} onCancel={cancel} />}
    {scan.lowRes && low && <ScanScale circle={low} source={scan.lowRes} role="low" partner={scan.highRes} zoom={zoom} canEdit={canEdit}
      active={lowHover.hovered || lowControl.hovered || draft?.id === scan.lowRes.id} hover={lowControl} onSelect={() => onSelect(scan.lowRes!.id)} onPreview={preview} onCommit={commit} onCancel={cancel} />}
  </>
}

function ScanDrag({ circle, source, role, canEdit, hover, onSelect, onPreview, onCommit, onCancel }: {
  circle: ScanCircle
  source: ScanCircle
  role: ScanRole
  canEdit: boolean
  hover: { enter: () => void; leave: () => void }
  onSelect: () => void
  onPreview: (source: ScanCircle, circle: ScanCircle) => void
  onCommit: (role: ScanRole, circle: ScanCircle) => void
  onCancel: () => void
}) {
  return <RigLineDragController rig={scanAsRig(circle)} interactive={canEdit} strokeWidth={2} hitRadius={scanOutlineHitRadius}
    onHoverChange={(hovered) => { if (hovered) hover.enter(); else hover.leave() }}
    onStart={onSelect}
    onCancel={onCancel}
    onPreview={(position) => onPreview(source, { ...source, position })}
    onCommit={(position) => onCommit(role, { ...source, position })} />
}

function ScanScale({ circle, source, role, partner, zoom, canEdit, active, hover, onSelect, onPreview, onCommit, onCancel }: {
  circle: ScanCircle
  source: ScanCircle
  role: ScanRole
  partner: ScanCircle | null
  zoom: number
  canEdit: boolean
  active: boolean
  hover: { enter: () => void; leave: () => void }
  onSelect: () => void
  onPreview: (source: ScanCircle, circle: ScanCircle) => void
  onCommit: (role: ScanRole, circle: ScanCircle) => void
  onCancel: () => void
}) {
  if (!active) return null
  const gap = scanGapMeters(source.position.lat, zoom)
  const label = role === 'high' ? 'Scale high res circle' : 'Scale low res circle'
  const colorClass = role === 'high' ? 'border-[#2563eb]! text-[#2563eb]!' : 'border-[#dc2626]! text-[#dc2626]!'
  function scaled(point: Position) {
    return scaleScanCircle(source, point, role, partner, gap)
  }
  return <MapObjectScale value={1 / 2}><MapHandle interactive={canEdit} position={destination(circle.position, circle.radiusMeters, 90)} label={label} className={`size-12! cursor-ew-resize ${colorClass}`} zIndex={200} minHitSize={scanHandleHitSize}
    constrain={(point) => destination(source.position, scaled(point).radiusMeters, 90)}
    onEnter={hover.enter} onLeave={hover.leave} onStart={onSelect} onCancel={onCancel}
    onPreview={(point) => onPreview(source, scaled(point))}
    onCommit={(point) => onCommit(role, scaled(point))}
    onStep={(delta) => onCommit(role, applyScanDiameter(source, snapScanDiameter(source.radiusMeters * 2 + delta * scanDiameterStep), role, partner, gap))}>
    <Circle className="size-4 fill-current" />
  </MapHandle></MapObjectScale>
}

function ScanShape({ active, circle, hole, pixelsToMeters, Polygon, Marker, role }: {
  circle: ScanCircle
  hole: ScanCircle | null
  pixelsToMeters: number
  active: boolean
  Polygon: ReturnType<typeof useObjectRenderer>['Polygon']
  Marker: ReturnType<typeof useObjectRenderer>['Marker']
  role: ScanRole
}) {
  const color = droneScanColor(role)
  const outer = circleOutline(circle)
  const holeRing = hole ? [...circleOutline(hole)].reverse() : null
  const label = `${role === 'high' ? 'High res' : 'Low res'} diameter ${formatScanDiameter(circle.radiusMeters)} meters`
  return <>
    <Polygon paths={holeRing ? [outer, holeRing] : outer} draggable={false} clickable={false}
      strokeWeight={holeRing ? 0 : active ? 6 : 2} strokeColor={color} fillColor={color} fillOpacity={droneScanFillOpacity} />
    {holeRing && <Polygon paths={outer} draggable={false} clickable={false} strokeColor={color} strokeWeight={active ? 6 : 2} fillOpacity={0} />}
    <Polygon paths={diameterBand(circle, Math.max(0.05, pixelsToMeters))} draggable={false} clickable={false}
      strokeWeight={0} fillColor={color} fillOpacity={1} />
    <Marker position={circle.position} anchorLeft="-50%" anchorTop="-50%" zIndex={role === 'high' ? 12 : 11} clickable={false}>
      <div role="img" aria-label={label} className="pointer-events-none rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm"
        style={{ color, transform: role === 'high' ? 'translateY(-14px)' : 'translateY(14px)' }}>
        {formatScanDiameter(circle.radiusMeters)} m
      </div>
    </Marker>
  </>
}

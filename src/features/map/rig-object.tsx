import { useMemo, useState } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Circle, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MapHandle } from './map-handle'
import { RigLineDragController } from './rig-line-drag-controller'
import { clamp, destination, reshapeRig, scaleAndRotateRig, rigOutline, rigArrows, rigRadiusHandle, type CircleRig } from './geometry'
import { useHoverHandles } from './use-hover-handles'
import { mapBrandColor } from './map-colors'
import { MapObjectScale } from './map-object-scale'

type Props = { rig: CircleRig; pixelsToMeters: number; dark?: boolean; editable: boolean; selected: boolean; interactive: boolean; onSelect: () => void; onCommit: (rig: CircleRig) => void }
export function RigObject({ rig, pixelsToMeters, dark = false, editable, interactive, onSelect, onCommit }: Props) {
  const { Marker: AdvancedMarker, Polygon } = useObjectRenderer()
  const color = mapBrandColor(dark)
  // Leaving the outline must not clear a control's active hover or focus.
  const hover = useHoverHandles(!interactive, 0)
  const controlHover = useHoverHandles(!interactive, 0)
  const rigHovered = hover.hovered || controlHover.hovered
  const strokeWeight = rigHovered ? 4 : 3
  const [draft, setDraft] = useState<{ source: CircleRig; value: CircleRig } | null>(null)
  const visible = draft?.source === rig ? draft.value : rig
  // All rig decorations keep a fixed proportion of its projected major radius.
  // A 400 px radius uses the base symbol sizes, including during resize previews.
  const scale = visible.radiusMeters / pixelsToMeters / 400
  const path = useMemo(() => rigOutline(visible), [visible])
  const canEdit = editable && interactive
  const handles = editable && (rigHovered || draft !== null)
  const radiusPoint = rigRadiusHandle(visible)
  const ovalPoint = destination(visible.position, visible.radiusMeters * visible.ovalRatio, visible.rotationDegrees + 90)
  function commit(value: CircleRig) {
    setDraft(null); hover.leave()
    if (canEdit) onCommit(value)
  }
  function start() { if (canEdit) onSelect() }
  return <MapObjectScale value={scale}>
    <Polygon paths={path} draggable={false} clickable={false}
      strokeColor={color} strokeWeight={canEdit && (rigHovered || draft !== null) ? Math.max(4, 6 * scale) : strokeWeight * scale}
      fillOpacity={0} />
    {rigArrows(visible).map((arrow) => <AdvancedMarker key={arrow.number} position={arrow.position}
      anchorLeft="-50%" anchorTop="-50%" title={'Rig arrow ' + arrow.number} zIndex={10}
      clickable={false} style={{ pointerEvents: 'none' }}>
      <div className="relative size-8" style={{ zoom: scale }} role="img" aria-label={'Rig arrow ' + arrow.number + ', pointing toward center'}>
        <div className="absolute inset-0"
        style={{ transform: `translate(${Math.sin(arrow.directionDegrees * Math.PI / 180) * 36}px, ${-Math.cos(arrow.directionDegrees * Math.PI / 180) * 36}px)` }}
        >
        <Navigation className="size-8 fill-white" size={32} strokeWidth={2} absoluteStrokeWidth
          style={{ color, transform: 'rotate(' + (arrow.directionDegrees - 45) + 'deg)' }} />
        </div>
        <Badge variant="outline" style={{ borderColor: color, borderWidth: strokeWeight, color }} className="bg-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-10 justify-center rounded-full p-0 text-lg font-semibold leading-none tabular-nums">{arrow.number}</Badge>
      </div>
    </AdvancedMarker>)}
    <RigLineDragController rig={visible} interactive={canEdit} strokeWidth={strokeWeight * scale}
      onHoverChange={(hovered) => { if (hovered) hover.enter(); else hover.leave() }}
      onStart={start} onCancel={() => { setDraft(null); hover.leave() }}
      onPreview={(position) => setDraft({ source: rig, value: { ...rig, position } })}
      onCommit={(position) => commit({ ...rig, position })} />
    {handles && <>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={radiusPoint} label="Scale and rotate circle rig" className="cursor-crosshair"
        onEnter={controlHover.enter} onLeave={controlHover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: scaleAndRotateRig(visible, point) })}
        onCommit={(point) => commit(scaleAndRotateRig(visible, point))}>
        <Circle className="size-3 fill-current" />
      </MapHandle>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={ovalPoint} label="Adjust rig ovalness" className="cursor-ew-resize"
        constrain={(point) => {
          const shaped = reshapeRig(visible, point)
          return destination(shaped.position, shaped.radiusMeters * shaped.ovalRatio, shaped.rotationDegrees + 90)
        }}
        onEnter={controlHover.enter} onLeave={controlHover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: reshapeRig(visible, point) })}
        onCommit={(point) => commit(reshapeRig(visible, point))}
        onStep={(delta) => commit({ ...visible, ovalRatio: clamp(visible.ovalRatio + delta * 0.05, 0.1, 1) })}>
        <Circle style={{ transform: 'scaleX(0.6)' }} />
      </MapHandle>
    </>}
  </MapObjectScale>
}

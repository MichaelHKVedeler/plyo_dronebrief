import { useMemo, useState } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Circle, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MapHandle } from './map-handle'
import { clamp, destination, reshapeRig, scaleAndRotateRig, rigOutline, type CircleRig } from './geometry'
import { useHoverHandles } from './use-hover-handles'

type Props = { rig: CircleRig; satellite?: boolean; editable: boolean; selected: boolean; interactive: boolean; onSelect: () => void; onCommit: (rig: CircleRig) => void }
export function RigObject({ rig, satellite = false, editable, selected, interactive, onSelect, onCommit }: Props) {
  const { Marker: AdvancedMarker, Polygon } = useObjectRenderer()
  const color = satellite ? '#ffffff' : '#2958bb'
  const hover = useHoverHandles(!interactive)
  const [draft, setDraft] = useState<{ source: CircleRig; value: CircleRig } | null>(null)
  const visible = draft?.source === rig ? draft.value : rig
  const path = useMemo(() => rigOutline(visible), [visible])
  const canEdit = editable && interactive
  const handles = editable && (selected || hover.hovered || draft !== null)
  const radiusPoint = destination(visible.position, visible.radiusMeters, visible.rotationDegrees)
  const ovalPoint = destination(visible.position, visible.radiusMeters * visible.ovalRatio, visible.rotationDegrees + 90)
  function commit(value: CircleRig) {
    setDraft(null); hover.leave()
    if (canEdit) onCommit(value)
  }
  function start() { if (canEdit) { onSelect(); hover.enter() } }
  return <>
    <Polygon paths={path} draggable={false} clickable={canEdit}
      strokeColor={color} strokeWeight={selected || hover.hovered ? 3 : 2}
      fillColor={color} fillOpacity={selected || hover.hovered ? 0.18 : 0.1}
      onMouseOver={hover.enter} onMouseOut={hover.leave}
      onClick={(event) => { event.domEvent?.stopPropagation(); if (canEdit) onSelect() }} />
    {editable && <AdvancedMarker position={visible.position} anchorLeft="-50%" anchorTop="-50%" title="Move circle rig"
      zIndex={15} draggable={canEdit} clickable={canEdit} style={{ pointerEvents: canEdit ? 'auto' : 'none' }}
      onMouseEnter={hover.enter} onMouseLeave={hover.leave}
      onDragCancel={() => setDraft(null)} onDragStart={start}
      onDrag={(event) => { if (canEdit && event.latLng) setDraft({ source: rig, value: { ...rig, position: event.latLng.toJSON() } }) }}
      onDragEnd={(event) => { if (canEdit && event.latLng) commit({ ...rig, position: event.latLng.toJSON() }) }}>
      <Button disabled={!canEdit} size="icon-sm" variant="outline" className="cursor-grab touch-none rounded-full border-primary text-primary shadow-md active:cursor-grabbing"
        aria-label="Move circle rig" onFocus={hover.enter} onBlur={hover.leave}
        onClick={(event) => { event.stopPropagation(); onSelect() }}><Move /></Button>
    </AdvancedMarker>}
    {handles && <>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={radiusPoint} label="Scale and rotate circle rig" className="cursor-crosshair"
        onEnter={hover.enter} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: scaleAndRotateRig(visible, point) })}
        onCommit={(point) => commit(scaleAndRotateRig(visible, point))}>
        <Circle className="size-3 fill-current" />
      </MapHandle>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={ovalPoint} label="Adjust rig ovalness" className="cursor-ew-resize"
        constrain={(point) => {
          const shaped = reshapeRig(visible, point)
          return destination(shaped.position, shaped.radiusMeters * shaped.ovalRatio, shaped.rotationDegrees + 90)
        }}
        onEnter={hover.enter} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: reshapeRig(visible, point) })}
        onCommit={(point) => commit(reshapeRig(visible, point))}
        onStep={(delta) => commit({ ...visible, ovalRatio: clamp(visible.ovalRatio + delta * 0.05, 0.1, 1) })}>
        <Circle style={{ transform: 'scaleX(0.6)' }} />
      </MapHandle>
    </>}
  </>
}

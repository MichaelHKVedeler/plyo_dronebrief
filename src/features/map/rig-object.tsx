import { useMemo, useRef, useState } from 'react'
import { AdvancedMarker, Polygon } from '@vis.gl/react-google-maps'
import { Circle, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MapHandle } from './map-handle'
import { clamp, destination, pathCenter, reshapeRig, scaleAndRotateRig, rigOutline, type CircleRig } from './geometry'
import { useHoverHandles } from './use-hover-handles'

type Props = { rig: CircleRig; editable: boolean; selected: boolean; interactive: boolean; onSelect: () => void; onCommit: (rig: CircleRig) => void }
export function RigObject({ rig, editable, selected, interactive, onSelect, onCommit }: Props) {
  const hover = useHoverHandles()
  const polygon = useRef<google.maps.Polygon | null>(null)
  const [draft, setDraft] = useState<{ source: CircleRig; value: CircleRig } | null>(null)
  const [moving, setMoving] = useState(false)
  const visible = draft?.source === rig ? draft.value : rig
  const path = useMemo(() => rigOutline(visible), [visible])
  const canEdit = editable && interactive
  const handles = canEdit && !moving && (selected || hover.hovered || draft !== null)
  const radiusPoint = destination(visible.position, visible.radiusMeters, visible.rotationDegrees)
  const ovalPoint = destination(visible.position, visible.radiusMeters * visible.ovalRatio / 2, visible.rotationDegrees + 90)
  function commit(value: CircleRig) {
    setDraft(null); setMoving(false); hover.leave()
    if (canEdit) onCommit(value)
  }
  function start() { onSelect(); hover.enter() }
  return <>
    <Polygon ref={polygon} paths={path} draggable={canEdit} clickable={canEdit}
      strokeColor="#2958bb" strokeWeight={selected || hover.hovered ? 3 : 2}
      fillColor="#2958bb" fillOpacity={selected || hover.hovered ? 0.18 : 0.1}
      onMouseOver={hover.enter} onMouseOut={hover.leave}
      onClick={(event) => { event.domEvent?.stopPropagation(); if (canEdit) onSelect() }}
      onDragStart={() => { start(); setMoving(true) }}
      onDragEnd={() => {
        if (!canEdit || !polygon.current) return
        const points = polygon.current.getPath().getArray().map((point) => point.toJSON())
        if (points.length) commit({ ...rig, position: pathCenter(points) })
      }} />
    {canEdit && <AdvancedMarker position={visible.position} anchorLeft="-50%" anchorTop="-50%" title="Move circle rig"
      zIndex={15} draggable
      onMouseEnter={hover.enter} onMouseLeave={hover.leave}
      onDragStart={start}
      onDrag={(event) => { if (event.latLng) setDraft({ source: rig, value: { ...rig, position: event.latLng.toJSON() } }) }}
      onDragEnd={(event) => { if (event.latLng) commit({ ...rig, position: event.latLng.toJSON() }) }}>
      <Button size="icon-sm" variant="outline" className="cursor-grab touch-none rounded-full border-primary text-primary shadow-md active:cursor-grabbing"
        aria-label="Move circle rig" onFocus={hover.enter} onBlur={hover.leave}
        onClick={(event) => { event.stopPropagation(); onSelect() }}><Move /></Button>
    </AdvancedMarker>}
    {handles && <>
      <MapHandle position={radiusPoint} label="Scale and rotate circle rig" className="cursor-crosshair"
        onEnter={hover.enter} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: scaleAndRotateRig(visible, point) })}
        onCommit={(point) => commit(scaleAndRotateRig(visible, point))}>
        <Circle className="size-3 fill-current" />
      </MapHandle>
      <MapHandle position={ovalPoint} label="Adjust rig ovalness" className="cursor-ew-resize"
        onEnter={hover.enter} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: reshapeRig(visible, point) })}
        onCommit={(point) => commit(reshapeRig(visible, point))}
        onStep={(delta) => commit({ ...visible, ovalRatio: clamp(visible.ovalRatio + delta * 0.05, 0.1, 1) })}>
        <Circle style={{ transform: 'scaleX(0.6)' }} />
      </MapHandle>
    </>}
  </>
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Circle, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MapHandle } from './map-handle'
import { RigLineDragController } from './rig-line-drag-controller'
import { clamp, reshapeRig, scaleAndRotateRig, rigOutline, rigArrows, rigOvalHandle, rigRadiusHandle, type CircleRig } from './geometry'
import { useHoverHandles } from './use-hover-handles'
import { mapBrandColor } from './map-colors'
import { MapObjectScale } from './map-object-scale'

export const compactRigStrokeScale = 2
export const compactRigNumberScale = 2

function useCompactRig() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1023px)')
    if (!media) return
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return compact
}

type Props = { rig: CircleRig; pixelsToMeters: number; dark?: boolean; editable: boolean; selected: boolean; interactive: boolean; onSelect: () => void; onCommit: (rig: CircleRig) => void }
export function RigObject({ rig, pixelsToMeters, dark = false, editable, interactive, onSelect, onCommit }: Props) {
  const { Marker: AdvancedMarker, Polygon } = useObjectRenderer()
  const color = mapBrandColor(dark)
  // Only hovering the rig outline highlights its stroke.
  const hover = useHoverHandles(!interactive, 0)
  const rigHovered = hover.hovered
  const compact = useCompactRig()
  const arrowScale = compact ? 1.5 : 1
  // Leave room for the enlarged mobile badge and rotated arrow, plus a visible gap.
  const arrowOffset = compact ? 64 : 36
  const [draft, setDraft] = useState<{ source: CircleRig; value: CircleRig } | null>(null)
  const visible = draft?.source === rig ? draft.value : rig
  // All rig decorations keep a fixed proportion of its projected major radius.
  // A 400 px radius uses the base symbol sizes, including during resize previews.
  const radiusScale = visible.radiusMeters / pixelsToMeters / 400
  const scale = radiusScale
  const numberScale = compact ? compactRigNumberScale : 1
  const baseStroke = rigHovered ? 6 : 5
  const outlineStroke = baseStroke * radiusScale * (compact ? compactRigStrokeScale : 1)
  const path = useMemo(() => rigOutline(visible), [visible])
  const outline = useRef<google.maps.Polygon | null>(null)
  // Google Maps normally applies paths in a passive effect, a frame after markers.
  useLayoutEffect(() => { outline.current?.setPaths(path) }, [path])
  const canEdit = editable && interactive
  const radiusPoint = rigRadiusHandle(visible)
  const ovalPoint = rigOvalHandle(visible)
  function commit(value: CircleRig) {
    setDraft(null); hover.leave()
    if (canEdit) onCommit(value)
  }
  function start() { if (canEdit) onSelect() }
  return <MapObjectScale value={scale * numberScale}>
    <Polygon ref={outline} paths={path} draggable={false} clickable={false}
      strokeColor={color} strokeWeight={canEdit && (rigHovered || draft !== null) ? Math.max(6, 8 * scale) * (compact ? compactRigStrokeScale : 1) : outlineStroke}
      fillOpacity={0} />
    {rigArrows(visible).map((arrow) => <AdvancedMarker key={arrow.number} position={arrow.position}
      anchorLeft="-50%" anchorTop="-50%" title={'Rig arrow ' + arrow.number} zIndex={10}
      clickable={false} style={{ pointerEvents: 'none' }}>
      <div data-rig-decoration={rig.id} className="relative size-8" style={{ scale }} role="img" aria-label={'Rig arrow ' + arrow.number + ', pointing toward center'}>
        <div data-rig-hover className="absolute inset-0"
        style={{ transform: `translate(${Math.sin(arrow.directionDegrees * Math.PI / 180) * arrowOffset}px, ${-Math.cos(arrow.directionDegrees * Math.PI / 180) * arrowOffset}px)` }}
        >
        <Navigation className="size-8 fill-white" size={32} strokeWidth={2} absoluteStrokeWidth
          style={{ color, transform: `rotate(${arrow.directionDegrees - 45}deg) scale(${arrowScale})` }} />
        </div>
        <Badge data-rig-hover variant="outline" style={{ borderColor: color, borderWidth: baseStroke, color, scale: numberScale }} className="bg-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-10 justify-center rounded-full p-0 text-lg font-semibold leading-none tabular-nums">{arrow.number}</Badge>
      </div>
    </AdvancedMarker>)}
    <RigLineDragController rig={visible} interactive={canEdit} strokeWidth={outlineStroke}
      onHoverChange={(hovered) => { if (hovered) hover.enter(); else hover.leave() }}
      onStart={start} onCancel={() => { setDraft(null); hover.leave() }}
      onPreview={(position) => setDraft({ source: rig, value: { ...rig, position } })}
      onCommit={(position) => commit({ ...rig, position })} />
    {canEdit && <>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={radiusPoint} label="Scale and rotate circle rig" className="size-10 cursor-crosshair" zIndex={200} minHitSize={40}
        constrain={(point) => rigRadiusHandle(scaleAndRotateRig(visible, point))}
        onEnter={hover.leave} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: scaleAndRotateRig(visible, point) })}
        onCommit={(point) => commit(scaleAndRotateRig(visible, point))}>
        <Circle className="size-4 fill-current" />
      </MapHandle>
      <MapHandle onCancel={() => setDraft(null)} interactive={canEdit} position={ovalPoint} label="Adjust rig ovalness" className="size-10 cursor-ew-resize" zIndex={200} minHitSize={40}
        constrain={(point) => {
          const shaped = reshapeRig(visible, point)
          return rigOvalHandle(shaped)
        }}
        onEnter={hover.leave} onLeave={hover.leave} onStart={start}
        onPreview={(point) => setDraft({ source: rig, value: reshapeRig(visible, point) })}
        onCommit={(point) => commit(reshapeRig(visible, point))}
        onStep={(delta) => commit({ ...visible, ovalRatio: clamp(visible.ovalRatio + delta * 0.05, 0.1, 1) })}>
        <Circle className="size-5" style={{ transform: 'scaleX(0.6)' }} />
      </MapHandle>
    </>}
  </MapObjectScale>
}

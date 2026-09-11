import { useState } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CameraAngle } from '@/features/briefs/model/brief'
import { cameraAppearance } from '@/features/briefs/components/camera-appearance'
import { bearingDegrees, destination, distanceMeters, normalizeHeading } from './geometry'
import { MapHandle } from './map-handle'
import { useHoverHandles } from './use-hover-handles'

type Props = {
  angle: CameraAngle
  editable: boolean
  selected: boolean
  pixelsToMeters: number
  interactive?: boolean
  onSelect: (additive?: boolean) => void
  onCommit: (angle: CameraAngle) => void
}
export function CameraMarker({ angle, editable, selected, pixelsToMeters, interactive = true, onSelect, onCommit }: Props) {
  const hover = useHoverHandles(!interactive)
  const [draft, setDraft] = useState<{ source: CameraAngle; value: CameraAngle } | null>(null)
  const visible = draft?.source === angle ? draft.value : angle
  const appearance = cameraAppearance[angle.type]
  const Icon = appearance.Icon
  const directional = visible.type !== '360'
  const target = directional ? destination(visible.position, pixelsToMeters * 31, visible.directionDegrees) : visible.position
  function commit(value: CameraAngle) {
    setDraft(null); hover.leave()
    if (editable && interactive) onCommit(value)
  }
  const symbol = <Icon className="size-5" />
  return <>
    <AdvancedMarker position={visible.position} anchorLeft="-50%" anchorTop="-50%" title={angle.label}
      zIndex={selected ? 30 : 20} draggable={editable && interactive} clickable={editable && interactive}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onMouseEnter={hover.enter} onMouseLeave={hover.leave}
      onDragStart={() => { if (editable && interactive) { onSelect(true); hover.enter() } }}
      onDrag={(event) => { if (editable && interactive && event.latLng) setDraft({ source: angle, value: { ...angle, position: event.latLng.toJSON() } }) }}
      onDragEnd={(event) => { if (editable && interactive && event.latLng) commit({ ...angle, position: event.latLng.toJSON() }) }}>
      <div className="relative">
        {editable ? <Button disabled={!interactive} size="icon" variant="outline" aria-label={'Move ' + angle.label} title={angle.label}
          className={'cursor-grab touch-none rounded-full border-2 shadow-md active:cursor-grabbing ' + appearance.className + (selected ? ' ring-2 ring-primary ring-offset-2' : '')}
          onFocus={hover.enter} onBlur={hover.leave}
          onPointerDownCapture={(event) => {
            if (event.button !== 0 || (!event.ctrlKey && !event.shiftKey)) return
            event.preventDefault(); event.stopPropagation()
            onSelect(true)
          }}
          onMouseDownCapture={(event) => {
            if (event.button === 0 && (event.ctrlKey || event.shiftKey)) {
              event.preventDefault(); event.stopPropagation()
            }
          }}
          onClick={(event) => { event.stopPropagation(); onSelect(event.ctrlKey || event.shiftKey) }}>{symbol}</Button>
          : <Badge className={'relative flex size-9 items-center justify-center rounded-full border-2 shadow-sm ' + appearance.className}>{symbol}</Badge>}
        <Badge variant="secondary" className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap">{angle.label}</Badge>
      </div>
    </AdvancedMarker>
    {directional && <MapHandle bare interactive={editable && interactive}
      position={target} label={'Aim ' + angle.label} className="cursor-crosshair"
      constrain={(point) => destination(visible.position, pixelsToMeters * 31,
        distanceMeters(visible.position, point) > 0.01 ? bearingDegrees(visible.position, point) : visible.directionDegrees)}
      onEnter={hover.enter} onLeave={hover.leave} onStart={() => { onSelect(true); hover.enter() }}
      onPreview={(point) => {
        if (distanceMeters(visible.position, point) > 0.01) setDraft({ source: angle, value: { ...visible, directionDegrees: bearingDegrees(visible.position, point) } })
      }}
      onCommit={(point) => commit({ ...visible, directionDegrees: distanceMeters(visible.position, point) > 0.01 ? bearingDegrees(visible.position, point) : visible.directionDegrees })}
      onStep={(delta) => commit({ ...visible, directionDegrees: normalizeHeading(visible.directionDegrees + delta * 5) })}>
      <Navigation className="size-7 fill-current drop-shadow-[0_1px_2px_white]" strokeWidth={2.5} style={{ color: appearance.color, transform: 'rotate(' + (visible.directionDegrees - 45) + 'deg)' }} />
    </MapHandle>}
  </>
}

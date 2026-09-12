import { useState } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cameraLabels, type CameraAngle, type DroneBrief } from '@/features/briefs/model/brief'
import { cameraAppearance } from '@/features/briefs/components/camera-appearance'
import { bearingDegrees, destination, distanceMeters, normalizeHeading } from './geometry'
import { MapHandle } from './map-handle'
import { useHoverHandles } from './use-hover-handles'
import { cameraDirectionLayout } from './camera-directions'
import { useMapObjectScale } from './map-object-scale'

type Props = {
  angle: CameraAngle
  editable: boolean
  selected: boolean
  pixelsToMeters: number
  interactive?: boolean
  number?: number
  dslrSettings?: DroneBrief['typeSettings']['dslr']
  onSelect: (additive?: boolean) => void
  onCommit: (angle: CameraAngle) => void
}
export function CameraMarker({ angle, editable, selected, pixelsToMeters, interactive = true, number = 1, dslrSettings, onSelect, onCommit }: Props) {
  const name = cameraLabels[angle.type] + ' ' + number
  const { Marker: AdvancedMarker } = useObjectRenderer()
  const scale = useMapObjectScale()
  const hover = useHoverHandles(!interactive)
  const [draft, setDraft] = useState<{ source: CameraAngle; value: CameraAngle } | null>(null)
  const visible = draft?.source === angle ? draft.value : angle
  const appearance = cameraAppearance[angle.type]
  const Icon = appearance.Icon
  const directional = visible.type !== '360'
  const { offsets, radiusPixels } = cameraDirectionLayout(angle.type === 'dslr' ? dslrSettings : undefined)
  const directionRadius = pixelsToMeters * radiusPixels * scale
  function commit(value: CameraAngle) {
    setDraft(null); hover.leave()
    if (editable && interactive) onCommit(value)
  }
  const symbol = <Icon className="size-5" />
  return <>
    <AdvancedMarker position={visible.position} anchorLeft="-50%" anchorTop="-50%" title={name}
      zIndex={selected ? 30 : 20} draggable={editable && interactive} clickable={editable && interactive}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onMouseEnter={hover.enter} onMouseLeave={hover.leave}
      onDragCancel={() => setDraft(null)} onDragStart={() => { if (editable && interactive) { onSelect(true); hover.enter() } }}
      onDrag={(event) => { if (editable && interactive && event.latLng) setDraft({ source: angle, value: { ...angle, position: event.latLng.toJSON() } }) }}
      onDragEnd={(event) => { if (editable && interactive && event.latLng) commit({ ...angle, position: event.latLng.toJSON() }) }}>
      <div className="relative" style={{ zoom: scale }}>
        {editable ? <Button disabled={!interactive} size="icon" variant="outline" aria-label={'Move ' + name} title={name}
          className={'cursor-pointer touch-none rounded-full border-2 shadow-md active:cursor-grabbing ' + appearance.className + (selected ? ' ring-2 ring-primary ring-offset-2' : '')}
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
        <Badge aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-background p-0 text-[10px] leading-none tabular-nums shadow-sm">{number}</Badge>
      </div>
    </AdvancedMarker>
    {directional && offsets.map((offset, index) => <MapHandle key={index} onCancel={() => setDraft(null)} bare interactive={editable && interactive}
      position={destination(visible.position, directionRadius, normalizeHeading(visible.directionDegrees + offset))}
      label={'Aim ' + name + (offsets.length > 1 ? ' angle ' + (index + 1) : '')} className="cursor-crosshair"
      constrain={(point) => destination(visible.position, directionRadius,
        distanceMeters(visible.position, point) > 0.01 ? bearingDegrees(visible.position, point) : normalizeHeading(visible.directionDegrees + offset))}
      onEnter={hover.enter} onLeave={hover.leave} onStart={() => { onSelect(true); hover.enter() }}
      onPreview={(point) => {
        if (distanceMeters(visible.position, point) > 0.01) setDraft({ source: angle, value: { ...visible, directionDegrees: normalizeHeading(bearingDegrees(visible.position, point) - offset) } })
      }}
      onCommit={(point) => commit({ ...visible, directionDegrees: distanceMeters(visible.position, point) > 0.01 ? normalizeHeading(bearingDegrees(visible.position, point) - offset) : visible.directionDegrees })}
      onStep={(delta) => commit({ ...visible, directionDegrees: normalizeHeading(visible.directionDegrees + delta * 5) })}>
      <Navigation className="size-7 fill-white" size={28} strokeWidth={2} absoluteStrokeWidth style={{ color: appearance.color, transform: 'rotate(' + (visible.directionDegrees + offset - 45) + 'deg)' }} />
    </MapHandle>)}
  </>
}

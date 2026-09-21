import { memo, useRef, useState } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cameraLabels, max360Fov, min360Fov, type CameraAngle, type DroneBrief, type Position } from '@/features/briefs/model/brief'
import { cameraAppearance } from '@/features/briefs/components/camera-appearance'
import { bearingDegrees, destination, distanceMeters, normalizeHeading } from './geometry'
import { MapHandle } from './map-handle'
import { useHoverHandles } from './use-hover-handles'
import { cameraArrowOffset, cameraDirectionLayout } from './camera-directions'
import { useMapObjectScale } from './map-object-scale'
import { PanoramaFocusCone } from './panorama-focus'
import { useCameraAimGesture, type CameraAim } from './use-camera-aim-gesture'

type Props = {
  angle: CameraAngle
  editable: boolean
  selected: boolean
  pixelsToMeters: number
  interactive?: boolean
  number?: number
  duplicateNumber?: number
  dslrSettings?: DroneBrief['typeSettings']['dslr']
  onSelect: (additive?: boolean) => void
  onCommit: (angle: CameraAngle) => void
  onDuplicate?: (position: Position) => void
}
function eventHasAlt(event?: google.maps.MapMouseEvent | null) {
  const source = event?.domEvent
  return Boolean(source && 'altKey' in source && source.altKey)
}
function CameraArrows({ offsets, directionDegrees, color }: { offsets: number[]; directionDegrees: number; color: string }) {
  return offsets.map((offset, index) => {
    const heading = directionDegrees + offset
    const { x, y } = cameraArrowOffset(heading)
    return <span key={index} data-camera-arrow aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 flex size-8 items-center justify-center"
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>
      <Navigation className="size-7 fill-white" size={28} strokeWidth={2} absoluteStrokeWidth style={{ color, transform: 'rotate(' + (heading - 45) + 'deg)' }} />
    </span>
  })
}
export const CameraMarker = memo(function CameraMarker({ angle, editable, selected, pixelsToMeters, interactive = true, number = 1, duplicateNumber, dslrSettings, onSelect, onCommit, onDuplicate }: Props) {
  const { Marker: AdvancedMarker } = useObjectRenderer()
  const scale = useMapObjectScale()
  const hover = useHoverHandles(!interactive)
  const altCopy = useRef(false)
  const duplicating = useRef(false)
  const [ghost, setGhost] = useState(false)
  const [markerKey, setMarkerKey] = useState(0)
  const [draft, setDraft] = useState<{ source: CameraAngle; value: CameraAngle } | null>(null)
  const visible = draft?.source === angle ? draft.value : angle
  const shownNumber = ghost ? (duplicateNumber ?? number) : number
  const name = cameraLabels[angle.type] + ' ' + shownNumber
  const appearance = cameraAppearance[angle.type]
  const Icon = appearance.Icon
  const directional = visible.type !== '360'
  const { offsets, radiusPixels } = cameraDirectionLayout(angle.type === 'dslr' ? dslrSettings : undefined)
  const directionRadius = pixelsToMeters * radiusPixels * scale
  const moving = draft !== null && (draft.value.position.lat !== draft.source.position.lat || draft.value.position.lng !== draft.source.position.lng)
  const showAim = directional && editable && interactive && !ghost && (hover.hovered || selected || (draft !== null && !moving))
  function resetPreview() {
    const snapBack = duplicating.current
    altCopy.current = false
    duplicating.current = false
    setGhost(false)
    setDraft(null)
    hover.leave()
    if (snapBack) setMarkerKey((key) => key + 1)
  }
  function commit(value: CameraAngle) {
    const cloning = duplicating.current
    resetPreview()
    if (!editable || !interactive) return
    if (cloning) onDuplicate?.(value.position)
    else onCommit(value)
  }
  function aimedAngle(aim: CameraAim): CameraAngle {
    if (angle.type === '360' && aim.insideIcon) {
      const { focus: _focus, ...unfocused } = angle
      return unfocused
    }
    if (angle.type === '360') return { ...angle, focus: {
      directionDegrees: aim.directionDegrees,
      fovDegrees: Math.max(min360Fov, Math.min(max360Fov, Math.round(aim.distancePixels))),
    } }
    return { ...angle, directionDegrees: aim.directionDegrees }
  }
  const startAim = useCameraAimGesture({
    enabled: editable && interactive && !ghost,
    onStart: (aim) => {
      onSelect(); hover.enter()
      if (angle.type === '360') setDraft({ source: angle, value: aimedAngle(aim) })
    },
    onPreview: (aim) => setDraft({ source: angle, value: aimedAngle(aim) }),
    onCommit: (aim) => commit(aimedAngle(aim)),
    onCancel: resetPreview,
  })
  const symbol = <Icon className="size-5" />
  // CSS zoom: 0 is invalid and would render full-size icons at the slider minimum.
  if (scale === 0) return null
  return <>
    {ghost && <CameraMarker angle={angle} editable selected={false} interactive={false} number={number} pixelsToMeters={pixelsToMeters}
      dslrSettings={dslrSettings} onSelect={() => {}} onCommit={() => {}} />}
    <AdvancedMarker key={markerKey} position={visible.position} anchorLeft="-50%" anchorTop="-50%" title={name}
      zIndex={selected || ghost ? 30 : 20} draggable={editable && interactive} clickable={editable && interactive}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onMouseEnter={hover.enter} onMouseLeave={hover.leave}
      onDragCancel={resetPreview} onDragStart={(event) => {
        if (!editable || !interactive) return
        duplicating.current = Boolean(onDuplicate) && (altCopy.current || eventHasAlt(event))
        setGhost(duplicating.current)
        if (!duplicating.current) onSelect(true)
        hover.enter()
      }}
      onDrag={(event) => { if (editable && interactive && event.latLng) setDraft({ source: angle, value: { ...angle, position: event.latLng.toJSON() } }) }}
      onDragEnd={(event) => { if (editable && interactive && event.latLng) commit({ ...angle, position: event.latLng.toJSON() }) }}>
      <div data-camera-marker={angle.id} className="relative" style={{ zoom: scale }} onMouseEnter={hover.enter} onMouseLeave={hover.leave}>
        {visible.type === '360' && visible.focus && <PanoramaFocusCone focus={visible.focus} color={appearance.color} />}
        {editable ? <Button disabled={!interactive} size="icon" variant="outline" aria-label={'Move ' + name}
          data-camera-aim-control={interactive ? '' : undefined}
          title={name + (angle.type === '360' ? ' · Right-drag to set focus width and direction' : ' · Right-drag to aim the camera') + (onDuplicate ? ' · Alt-drag to duplicate' : '')}
          className={'relative cursor-pointer touch-none rounded-full border-2 shadow-md active:cursor-grabbing ' + appearance.className + (selected || ghost ? ' ring-2 ring-primary ring-offset-2' : '')}
          onFocus={hover.enter} onBlur={hover.leave} onMouseEnter={hover.enter} onMouseLeave={hover.leave}
          onPointerDownCapture={(event) => {
            if (startAim(event)) return
            if (event.button !== 0) return
            if (event.ctrlKey || event.shiftKey) {
              event.preventDefault(); event.stopPropagation()
              onSelect(true)
              return
            }
            altCopy.current = Boolean(onDuplicate) && event.altKey
          }}
          onMouseDownCapture={(event) => {
            if (event.button === 0 && (event.ctrlKey || event.shiftKey)) {
              event.preventDefault(); event.stopPropagation()
            }
          }}
          onClick={(event) => { event.stopPropagation(); altCopy.current = false; onSelect(event.ctrlKey || event.shiftKey) }}>{symbol}</Button>
          : <span role="img" aria-label={name} className={'relative inline-flex size-9 items-center justify-center rounded-full border-2 shadow-md ' + appearance.className}>{symbol}</span>}
        <Badge data-camera-badge aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-background p-0 text-[10px] leading-none tabular-nums shadow-sm">{shownNumber}</Badge>
        {directional && <CameraArrows offsets={offsets} directionDegrees={visible.directionDegrees} color={appearance.color} />}
      </div>
    </AdvancedMarker>
    {showAim && offsets.map((offset, index) => <MapHandle key={index} cameraId={angle.id} onCancel={resetPreview} bare hitAreaOnly interactive={editable && interactive}
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
})

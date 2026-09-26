import { useEffect, useRef, type PointerEvent } from 'react'
import { Slider } from '@/components/ui/slider'
import { ensureShootRange, type ShootSlot } from '@/features/briefs/model/brief'
import { moveShootEndpoint, type ShootEndpoint } from './shoot-time-range'
import { shadowSliderMax, shadowSliderStep, timeMinutes } from './shadow-time'

type Props = {
  slot: ShootSlot; name: string; zone: string; active: boolean; endpoint: ShootEndpoint
  onSelect: (endpoint: ShootEndpoint) => void
  onPreview: (slot: ShootSlot) => void
  onCommit: (slot: ShootSlot) => void
}
type Drag = {
  id: number; initial: ShootSlot; preview: ShootSlot; endpoint: ShootEndpoint
  rect: DOMRect; cancel: () => void
}
function pointerMinutes(x: number, rect: DOMRect) {
  const fraction = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
  return Math.min(shadowSliderMax, Math.round(fraction * shadowSliderMax / shadowSliderStep) * shadowSliderStep)
}

export function ShootTimeSlider({ slot: stored, name, zone, active, endpoint, onSelect, onPreview, onCommit }: Props) {
  const slot = ensureShootRange(stored)
  const drag = useRef<Drag | null>(null)
  useEffect(() => {
    const cancel = () => { const current = drag.current; drag.current = null; current?.cancel() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); cancel() }
  }, [])
  function cancel() { const current = drag.current; drag.current = null; current?.cancel() }
  function move(event: PointerEvent<HTMLSpanElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    current.preview = moveShootEndpoint(current.initial, current.endpoint, pointerMinutes(event.clientX, current.rect))
    onPreview(current.preview)
  }
  return <Slider value={[timeMinutes(slot.time), timeMinutes(slot.endTime ?? slot.time)]}
    min={0} max={shadowSliderMax} step={1} className="my-1 min-h-5"
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}
    onPointerDownCapture={(event) => {
      // Radix normally moves the nearest thumb. Track drags here move the
      // selected endpoint; clicking a thumb selects it without moving it.
      event.stopPropagation()
      if (event.button !== 0) { event.preventDefault(); return }
      const thumb = event.target instanceof Element ? event.target.closest('[data-slot="slider-thumb"]') : null
      const nextEndpoint = thumb?.getAttribute('data-endpoint') === '1' ? 1 : thumb ? 0 : endpoint
      onSelect(nextEndpoint)
      event.preventDefault()
      if (!active && !thumb) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (!rect.width) return
      drag.current = { id: event.pointerId, initial: slot, preview: slot, endpoint: nextEndpoint, rect, cancel: () => onPreview(slot) }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.querySelector<HTMLElement>(`[data-endpoint="${nextEndpoint}"]`)?.focus()
      if (!thumb) move(event)
    }}
    onPointerMoveCapture={move}
    onPointerUpCapture={(event) => {
      const current = drag.current
      if (!current || current.id !== event.pointerId) return
      drag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (current.preview.time !== current.initial.time || current.preview.endTime !== current.initial.endTime) onCommit(current.preview)
    }}
    onPointerCancel={cancel} onLostPointerCapture={cancel}
    onKeyDownCapture={(event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-slot="slider-thumb"]') : null
      if (!target) return
      const selected: ShootEndpoint = target.getAttribute('data-endpoint') === '1' ? 1 : 0
      const value = timeMinutes(selected === 1 && slot.endTime ? slot.endTime : slot.time)
      const nextValue = { ArrowLeft: value - shadowSliderStep, ArrowDown: value - shadowSliderStep,
        ArrowRight: value + shadowSliderStep, ArrowUp: value + shadowSliderStep,
        PageDown: value - 150, PageUp: value + 150, Home: 0, End: shadowSliderMax }[event.key]
      if (nextValue === undefined) return
      event.preventDefault(); event.stopPropagation()
      const next = moveShootEndpoint(slot, selected, nextValue)
      onSelect(selected); onPreview(next)
      if (next.time !== slot.time || next.endTime !== slot.endTime) onCommit(next)
    }}
    thumbProps={(index) => ({
      'data-endpoint': index,
      'aria-label': `${name} ${index === 0 ? 'start' : 'end'}`,
      'aria-valuetext': `${index === 1 ? slot.endTime : slot.time} ${zone}`,
      className: active && index === endpoint ? 'ring-2 ring-primary' : undefined,
      onFocus: () => onSelect(index === 1 ? 1 : 0),
    })} />
}

import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { ensureShootRange, type ShootSlot } from '@/features/briefs/model/brief'
import { moveShootEndpoint, moveShootRange, type ShootEndpoint } from './shoot-time-range'
import { shadowSliderMax, shadowSliderStep, timeLabel, timeMinutes } from './shadow-time'
import type { Daylight } from './sunlight-times'

type Props = {
  slot: ShootSlot; name: string; zone: string; active: boolean; endpoint: ShootEndpoint
  daylight?: Daylight
  onSelect: (endpoint: ShootEndpoint) => void
  onPreview: (slot: ShootSlot) => void
  onCommit: (slot: ShootSlot) => void
}
type Drag = {
  id: number; initial: ShootSlot; preview: ShootSlot; endpoint: ShootEndpoint | 'range'
  start: number; rect: DOMRect; cancel: () => void
}
function pointerMinutes(x: number, rect: DOMRect) {
  const fraction = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
  return Math.min(shadowSliderMax, Math.round(fraction * shadowSliderMax / shadowSliderStep) * shadowSliderStep)
}
const percent = (minutes: number) => `${(minutes / shadowSliderMax * 100).toFixed(2)}%`
const daylightColors = { golden: 'rgb(245 158 11 / 0.55)', day: 'rgb(56 189 248 / 0.35)' }
/** Hard-stop gradient: flat bands for golden hours and daytime over the track's night color. */
function daylightGradient(daylight: Daylight) {
  const stops: string[] = []
  let cursor = 0
  for (const { kind, start, end } of daylight.segments) {
    if (start > cursor) stops.push(`transparent ${percent(cursor)} ${percent(start)}`)
    stops.push(`${daylightColors[kind]} ${percent(start)} ${percent(end)}`)
    cursor = end
  }
  stops.push(`transparent ${percent(cursor)} 100%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

export function ShootTimeSlider({ slot: stored, name, zone, active, endpoint, daylight, onSelect, onPreview, onCommit }: Props) {
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
    const minutes = pointerMinutes(event.clientX, current.rect)
    current.preview = current.endpoint === 'range'
      ? moveShootRange(current.initial, minutes - current.start)
      : moveShootEndpoint(current.initial, current.endpoint, minutes)
    onPreview(current.preview)
  }
  // The map previews the selected endpoint, so its time rides above that handle with a sun below.
  const shown = endpoint === 1 && slot.endTime ? slot.endTime : slot.time
  const shownAt = percent(timeMinutes(shown))
  const shownFraction = timeMinutes(shown) / shadowSliderMax
  const shownShift = shownFraction < 0.04 ? '0' : shownFraction > 0.96 ? '-100%' : '-50%'
  // Match the band under the handle: golden hour, daytime, or night outside both.
  const band = daylight?.segments.find(({ start, end }) => timeMinutes(shown) >= start && timeMinutes(shown) < end)?.kind
  const ShownIcon = band === 'golden' ? Sunset : band === 'day' || !daylight ? Sun : Moon
  return <div className="grid gap-0.5">
    <div className="relative h-4 text-xs font-semibold tabular-nums" aria-hidden="true">
      {active && <span className="absolute" style={{ left: shownAt, transform: `translateX(${shownShift})` }}>{shown}</span>}
    </div>
    <Slider value={[timeMinutes(slot.time), timeMinutes(slot.endTime ?? slot.time)]}
      min={0} max={shadowSliderMax} step={1}
      // The track is the day: night stays the muted track color under the daylight bands.
      // The range is a window over it that can be grabbed to move the whole range.
      className="my-1 min-h-8 [&_[data-slot=slider-range]]:cursor-grab [&_[data-slot=slider-range]]:rounded-md [&_[data-slot=slider-range]]:border-2 [&_[data-slot=slider-range]]:border-primary [&_[data-slot=slider-range]]:bg-primary/25 active:[&_[data-slot=slider-range]]:cursor-grabbing [&_[data-slot=slider-track]]:h-7! [&_[data-slot=slider-track]]:rounded-md [&_[data-slot=slider-track]]:[background-image:var(--daylight)]"
      style={daylight ? { '--daylight': daylightGradient(daylight) } as CSSProperties : undefined}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}
      onPointerDownCapture={(event) => {
        // Radix normally moves the nearest thumb. Track drags here move the
        // selected endpoint, range drags move both, and clicking a thumb selects it without moving it.
        event.stopPropagation()
        if (event.button !== 0) { event.preventDefault(); return }
        const target = event.target instanceof Element ? event.target : null
        const thumb = target?.closest('[data-slot="slider-thumb"]')
        const range = !thumb && target?.closest('[data-slot="slider-range"]')
        const nextEndpoint = thumb?.getAttribute('data-endpoint') === '1' ? 1 : thumb ? 0 : endpoint
        onSelect(nextEndpoint)
        event.preventDefault()
        if (!active && !thumb && !range) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect.width) return
        drag.current = { id: event.pointerId, initial: slot, preview: slot, endpoint: range ? 'range' : nextEndpoint,
          start: pointerMinutes(event.clientX, rect), rect, cancel: () => onPreview(slot) }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.querySelector<HTMLElement>(`[data-endpoint="${nextEndpoint}"]`)?.focus()
        if (!thumb && !range) move(event)
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
        const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key]
        let next: ShootSlot
        // Shift+arrows move the whole range, the keyboard twin of dragging the window.
        if (event.shiftKey && step) next = moveShootRange(slot, step * shadowSliderStep)
        else {
          const value = timeMinutes(selected === 1 && slot.endTime ? slot.endTime : slot.time)
          const nextValue = step ? value + step * shadowSliderStep
            : { PageDown: value - 150, PageUp: value + 150, Home: 0, End: shadowSliderMax }[event.key]
          if (nextValue === undefined) return
          next = moveShootEndpoint(slot, selected, nextValue)
        }
        event.preventDefault(); event.stopPropagation()
        onSelect(selected); onPreview(next)
        if (next.time !== slot.time || next.endTime !== slot.endTime) onCommit(next)
      }}
      thumbProps={(index) => ({
        'data-endpoint': index,
        'aria-label': `${name} ${index === 0 ? 'start' : 'end'}`,
        'aria-valuetext': `${index === 1 ? slot.endTime : slot.time} ${zone}`,
        'aria-keyshortcuts': 'Shift+ArrowLeft Shift+ArrowRight',
        className: cn('h-8! w-2.5! cursor-ew-resize rounded-sm!', active && index === endpoint && 'ring-2 ring-primary'),
        onFocus: () => onSelect(index === 1 ? 1 : 0),
      })} />
    <div className="relative h-4" aria-hidden="true">
      {active && <ShownIcon className={cn('absolute size-4 -translate-x-1/2', ShownIcon === Moon ? 'text-sky-200' : 'text-amber-500')} style={{ left: shownAt }} />}
    </div>
    {daylight && <div className="relative h-4 text-xs text-muted-foreground tabular-nums" aria-hidden="true">
      <span className="absolute left-0">00</span>
      {daylight.sunrise !== null && <span className="absolute inline-flex -translate-x-1/2 items-center gap-1" style={{ left: percent(daylight.sunrise) }}><Sunrise className="size-3.5" />{timeLabel(daylight.sunrise)}</span>}
      {daylight.sunset !== null && <span className="absolute inline-flex -translate-x-1/2 items-center gap-1" style={{ left: percent(daylight.sunset) }}><Sunset className="size-3.5" />{timeLabel(daylight.sunset)}</span>}
      <span className="absolute right-0">24</span>
    </div>}
  </div>
}

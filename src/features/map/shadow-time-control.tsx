import { useId, useState, type PointerEvent } from 'react'
import { Calendar, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { maxShootSlots, nextShootSlot, type Position, type ShootSlot } from '@/features/briefs/model/brief'
import { shadowTime, shadowSliderMax, shadowSliderStep, timeLabel, timeMinutes } from './shadow-time'

function formatSlotDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function inactiveTrackPointerDown(event: PointerEvent<HTMLElement>) {
  const target = event.target
  if (!(target instanceof Element) || !target.closest('[data-slot=slider-thumb]')) {
    event.preventDefault()
    event.stopPropagation()
  }
}

export function ShadowTimeControl({ slots, activeIndex, onActivate, onChange, onCommit, position }: {
  slots: ShootSlot[]
  activeIndex: number
  onActivate: (index: number) => void
  onChange: (slots: ShootSlot[]) => void
  onCommit: (slots: ShootSlot[]) => void
  position: Position
}) {
  const [open, setOpen] = useState(true)
  const panelId = useId()
  const shown = slots[Math.min(activeIndex, slots.length - 1)] ?? slots[0]
  const zone = shown ? shadowTime(shown.date, timeMinutes(shown.time), position).zone : ''
  function replace(index: number, patch: Partial<ShootSlot>, commit = false) {
    onActivate(index)
    const next = slots.map((slot, i) => i === index ? { ...slot, ...patch } : slot)
    onChange(next)
    if (commit) onCommit(next)
  }
  return <div className="grid gap-2">
    <div className="flex items-center gap-2">
      {!open && <ul className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        {slots.map((slot, index) => {
          const time = shadowTime(slot.date, timeMinutes(slot.time), position)
          const timeName = slots.length === 1 ? 'Shadow time' : `Shadow time ${index + 1}`
          return <li key={index}>
            <button type="button" className={index === activeIndex ? 'tabular-nums' : 'tabular-nums opacity-50'}
              aria-current={index === activeIndex ? 'true' : undefined} aria-label={timeName}
              onClick={() => onActivate(index)}>
              <time dateTime={`${slot.date}T${slot.time}`}>{slot.date} · {time.actualTime}</time>
            </button>
          </li>
        })}
      </ul>}
      <Button type="button" variant="ghost" size="icon-sm" className={open ? 'mx-auto' : 'ml-auto shrink-0'}
        aria-expanded={open} aria-controls={panelId} aria-label={open ? 'Collapse times' : 'Expand times'}
        onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown /> : <ChevronUp />}
      </Button>
    </div>
    <div id={panelId} hidden={!open} className="grid gap-2">
      {slots.map((slot, index) => {
        const minutes = timeMinutes(slot.time)
        const time = shadowTime(slot.date, minutes, position)
        const timeName = slots.length === 1 ? 'Shadow time' : `Shadow time ${index + 1}`
        const dateName = slots.length === 1 ? 'Shadow date' : `Shadow date ${index + 1}`
        return <div key={index} className={index === activeIndex ? 'grid gap-1' : 'grid gap-1 opacity-50'}
          aria-current={index === activeIndex ? 'true' : undefined} onPointerDownCapture={() => onActivate(index)}>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="h-7 shrink-0 text-left" aria-label={dateName + ' text'}
              onClick={() => onActivate(index)}>
              <time dateTime={slot.date}>{formatSlotDate(slot.date)}</time>
            </button>
            <span className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-accent">
              <Calendar className="pointer-events-none size-4" />
              <Input id={'shadow-date-' + index} type="date" value={slot.date} required aria-label={dateName}
                className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none dark:bg-transparent"
                onKeyDown={(event) => { if (event.key !== 'Tab') event.preventDefault() }}
                onPaste={(event) => event.preventDefault()}
                onClick={(event) => event.currentTarget.showPicker?.()}
                onChange={(event) => { if (event.target.value) replace(index, { date: event.target.value }, true) }} />
            </span>
            <strong className="ml-auto shrink-0 tabular-nums">{time.actualTime}</strong>
            {slots.length > 1 && <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={'Remove ' + timeName}
              onClick={() => {
                const next = slots.filter((_, i) => i !== index)
                onChange(next); onCommit(next)
                onActivate(index < activeIndex ? activeIndex - 1 : Math.min(activeIndex, next.length - 1))
              }}><X /></Button>}
          </div>
          <Slider value={[Math.min(minutes, shadowSliderMax)]} min={0} max={shadowSliderMax} step={shadowSliderStep}
            onPointerDownCapture={index === activeIndex ? undefined : inactiveTrackPointerDown}
            onValueChange={([value]) => replace(index, { time: timeLabel(value) })}
            onValueCommit={([value]) => replace(index, { time: timeLabel(value) }, true)}
            thumbProps={{ 'aria-label': timeName, 'aria-valuetext': `${slot.time} ${time.zone}` }} />
          {time.adjusted && <p className="text-xs text-muted-foreground">Adjusted for daylight saving</p>}
        </div>
      })}
      {slots.length < maxShootSlots && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => {
        const next = [...slots, nextShootSlot(slots)]
        onChange(next); onCommit(next)
        onActivate(next.length - 1)
      }}><Plus /> Add time</Button>}
      {zone && <p className="text-xs text-muted-foreground">{zone}</p>}
    </div>
  </div>
}

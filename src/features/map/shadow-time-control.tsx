import { useId, useRef, useState, type ComponentProps } from 'react'
import { Calendar, ChevronDown, ChevronUp, Clock3, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ensureShootRange, maxShootSlots, nextShootSlot, type Position, type ShootSlot } from '@/features/briefs/model/brief'
import { shadowTime, timeMinutes } from './shadow-time'
import { previewShootSlot, type ShootEndpoint } from './shoot-time-range'
import { ShootTimeSlider } from './shoot-time-slider'

function formatSlotDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ShadowTimeControl({ slots, activeIndex, activeEndpoint = 0, onActivate, onChange, onCommit, position }: {
  slots: ShootSlot[]
  activeIndex: number
  activeEndpoint?: ShootEndpoint
  onActivate: (index: number, endpoint?: ShootEndpoint) => void
  onChange: (slots: ShootSlot[]) => void
  onCommit: (slots: ShootSlot[]) => void
  position: Position
}) {
  const [open, setOpen] = useState(true)
  const panelId = useId()
  const dateInput = useRef<HTMLInputElement>(null)
  const ranged = slots.map(ensureShootRange)
  const shown = ranged[Math.min(activeIndex, ranged.length - 1)] ?? ranged[0]
  const date = ranged[0]?.date ?? ''
  const zone = shown ? shadowTime(shown.date, timeMinutes(shown.time), position).zone : ''
  function replace(index: number, slot: ShootSlot, commit = false) {
    const next = ranged.map((current, i) => ensureShootRange(i === index ? slot : current))
    onChange(next)
    if (commit) onCommit(next)
  }
  function setDate(nextDate: string) {
    const next = ranged.map((slot) => ({ ...slot, date: nextDate }))
    onChange(next); onCommit(next)
  }
  function timeButtons(slot: ShootSlot, index: number) {
    const name = ranged.length === 1 ? 'Shadow time' : `Shadow time ${index + 1}`
    return <span className="inline-flex items-center gap-1 tabular-nums">
      {[slot.time, slot.endTime ?? slot.time].map((value, endpoint) => {
        const selected = index === activeIndex && endpoint === activeEndpoint
        const actual = shadowTime(slot.date, timeMinutes(value), position)
        return <span key={endpoint} className="inline-flex items-center gap-1">
          {endpoint === 1 && <span aria-hidden="true">–</span>}
          <Button type="button" variant="ghost" size="sm" className={`h-7 px-1 font-semibold ${selected ? 'text-primary' : ''}`}
            aria-current={selected ? 'true' : undefined}
            aria-label={`${name} ${endpoint === 0 ? 'start' : 'end'}`}
            onClick={() => onActivate(index, endpoint === 1 ? 1 : 0)}>
            <time dateTime={`${slot.date}T${value}`}>{actual.actualTime}</time>
          </Button>
        </span>
      })}
    </span>
  }
  return <div className="grid gap-2">
    <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {date && <>
          <Button type="button" variant="ghost" className="h-8 shrink-0 px-0 text-left font-normal" aria-label="Shadow date text"
            onClick={() => dateInput.current?.showPicker?.()}><time dateTime={date}>{formatSlotDate(date)}</time></Button>
          <span className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-accent">
            <Calendar className="pointer-events-none size-4" />
            <Input ref={dateInput} type="date" value={date} required aria-label="Shadow date"
              className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none dark:bg-transparent"
              onKeyDown={(event) => { if (event.key !== 'Tab') event.preventDefault() }}
              onPaste={(event) => event.preventDefault()}
              onClick={(event) => event.currentTarget.showPicker?.()}
              onChange={(event) => { if (event.target.value) setDate(event.target.value) }} />
          </span>
        </>}
        {!open && <ul className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          {ranged.map((slot, index) => <li key={index} className={index === activeIndex ? '' : 'opacity-50'}>{timeButtons(slot, index)}</li>)}
        </ul>}
      </div>
      <Button type="button" variant="ghost" size="icon-sm"
        aria-expanded={open} aria-controls={panelId} aria-label={open ? 'Collapse times' : 'Expand times'}
        onClick={() => setOpen((value) => !value)}>{open ? <ChevronDown /> : <ChevronUp />}</Button>
    </div>
    <div id={panelId} hidden={!open} className="grid gap-2">
      {ranged.map((slot, index) => {
        const selected = index === activeIndex
        const endpoint = selected ? activeEndpoint : 0
        const preview = previewShootSlot(slot, endpoint)
        const time = shadowTime(slot.date, timeMinutes(preview.time), position)
        const timeName = ranged.length === 1 ? 'Shadow time' : `Shadow time ${index + 1}`
        return <div key={index} className={selected ? 'grid gap-1' : 'grid gap-1 opacity-50'} aria-current={selected ? 'true' : undefined}>
          <div className="flex items-center justify-between gap-2 text-sm">
            {timeButtons(slot, index)}
            <div className="flex items-center">
              {ranged.length > 1 && <Button type="button" variant="ghost" size="icon-sm" aria-label={'Remove ' + timeName}
                onClick={() => {
                  const next = ranged.filter((_, i) => i !== index)
                  onChange(next); onCommit(next)
                  onActivate(index < activeIndex ? activeIndex - 1 : Math.min(activeIndex, next.length - 1), index === activeIndex ? 0 : activeEndpoint)
                }}><X /></Button>}
            </div>
          </div>
          <ShootTimeSlider slot={slot} name={timeName} zone={time.zone} active={selected} endpoint={endpoint}
            onSelect={(value) => onActivate(index, value)} onPreview={(value) => replace(index, value)} onCommit={(value) => replace(index, value, true)} />
          {time.adjusted && <p className="text-xs text-muted-foreground">Adjusted for daylight saving</p>}
        </div>
      })}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {ranged.length < maxShootSlots && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => {
          const added = nextShootSlot(ranged)
          const next = [...ranged, { ...added, date: ranged[0]?.date ?? added.date }]
          onChange(next); onCommit(next); onActivate(next.length - 1, 0)
        }}><Plus /> Add time</Button>}
        {zone && <p className="text-xs text-muted-foreground">{zone}</p>}
      </div>
      <p className="text-xs text-muted-foreground">Select either time to preview its shadows.</p>
    </div>
  </div>
}

export function ResponsiveShadowTimeControl(props: ComponentProps<typeof ShadowTimeControl>) {
  const slot = props.slots[props.activeIndex] ?? props.slots[0]
  const selected = slot ? previewShootSlot(slot, props.activeEndpoint ?? 0).time : ''
  return <>
    <div className="hidden @min-[500px]:block"><ShadowTimeControl {...props} /></div>
    <div className="@min-[500px]:hidden">
      <Dialog>
        <DialogTrigger asChild><Button variant="ghost" className="h-auto w-full flex-wrap px-1" aria-label="Edit shoot times"><Clock3 />{selected}</Button></DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
          <DialogHeader><DialogTitle>Shoot times</DialogTitle><DialogDescription>Select a time to preview its shadows on the map.</DialogDescription></DialogHeader>
          <ShadowTimeControl {...props} />
        </DialogContent>
      </Dialog>
    </div>
  </>
}

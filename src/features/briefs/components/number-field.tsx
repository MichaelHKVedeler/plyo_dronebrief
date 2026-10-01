import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NumberField({ label, value, min, max, onChange, live = false, step = 'any', resetValue, resetKey = label }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; live?: boolean; step?: number | 'any'; resetValue?: number; resetKey?: string }) {
  const id = useId()
  const [draft, setDraft] = useState({ source: value, text: String(value) })
  const [initial, setInitial] = useState({ key: resetKey, value })
  if (initial.key !== resetKey) setInitial({ key: resetKey, value })
  if (draft.source !== value) setDraft({ source: value, text: String(value) })
  function valid(next: number) {
    return Number.isFinite(next) && next >= min && next <= max && (step !== 1 || Number.isInteger(next))
  }
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type="number" step={step} min={min} max={max} value={draft.text} onContextMenu={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      const overSpinnerArrows = bounds.width > 0 && event.clientX >= bounds.right - 24 && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      if (!overSpinnerArrows) return
      event.preventDefault()
      const next = Math.min(max, Math.max(min, resetValue ?? initial.value))
      setDraft({ source: next, text: String(next) })
      if (next !== value) onChange(next)
    }} onChange={(event) => {
      const next = event.currentTarget.valueAsNumber
      setDraft({ source: live && valid(next) ? next : value, text: event.currentTarget.value })
      if (live && valid(next) && next !== value) onChange(next)
    }} onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber
      if (!valid(next)) { setDraft({ source: value, text: String(value) }); return }
      if (next !== value) onChange(next)
      setDraft({ source: next, text: String(next) })
    }} />
  </div>
}

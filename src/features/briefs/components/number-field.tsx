import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NumberField({ label, value, min, max, onChange, live = false, step = 'any' }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; live?: boolean; step?: number | 'any' }) {
  const id = useId()
  const [draft, setDraft] = useState({ source: value, text: String(value) })
  if (draft.source !== value) setDraft({ source: value, text: String(value) })
  function valid(next: number) {
    return Number.isFinite(next) && next >= min && next <= max && (step !== 1 || Number.isInteger(next))
  }
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type="number" step={step} min={min} max={max} value={draft.text} onChange={(event) => {
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

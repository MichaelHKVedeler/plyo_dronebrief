import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const id = useId()
  return <div className="grid gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input key={value} id={id} type="number" step="any" min={min} max={max} defaultValue={value} onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber
      if (!Number.isFinite(next) || next < min || next > max) { event.currentTarget.value = String(value); return }
      if (next !== value) onChange(next)
    }} />
  </div>
}

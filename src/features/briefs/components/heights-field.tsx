import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatHeightsMeters, parseHeightsMeters } from '../model/brief'

function sameHeights(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function HeightsField({ id, value, onChange, allowEmpty = false, placeholder, className, label }: {
  id: string
  value: number[]
  onChange: (heights: number[]) => void
  allowEmpty?: boolean
  placeholder?: string
  className?: string
  label?: string
}) {
  const serialized = formatHeightsMeters(value)
  const [draft, setDraft] = useState({ source: serialized, text: serialized })
  if (draft.source !== serialized) setDraft({ source: serialized, text: serialized })
  function commit(text: string, blur: boolean) {
    if (allowEmpty && !text.trim()) {
      setDraft({ source: '', text: '' })
      if (value.length) onChange([])
      return
    }
    const parsed = parseHeightsMeters(text)
    if (!parsed?.length) {
      setDraft({ source: blur ? serialized : draft.source, text: blur ? serialized : text })
      return
    }
    setDraft({ source: formatHeightsMeters(parsed), text: blur ? formatHeightsMeters(parsed) : text })
    if (!sameHeights(parsed, value)) onChange(parsed)
  }
  return <Input id={id} aria-label={label} placeholder={placeholder} className={className ?? 'min-w-0 flex-1'} value={draft.text}
    onChange={(event) => commit(event.currentTarget.value, false)}
    onBlur={(event) => commit(event.currentTarget.value, true)} />
}

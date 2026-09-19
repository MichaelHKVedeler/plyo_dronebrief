import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatHeightsMeters, parseHeightsMeters } from '../model/brief'

function sameHeights(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function HeightsField({ id, value, onChange }: { id: string; value: number[]; onChange: (heights: number[]) => void }) {
  const serialized = formatHeightsMeters(value)
  const [draft, setDraft] = useState({ source: serialized, text: serialized })
  if (draft.source !== serialized) setDraft({ source: serialized, text: serialized })
  return <Input id={id} className="min-w-0 flex-1" value={draft.text} onChange={(event) => {
    const text = event.currentTarget.value
    const parsed = parseHeightsMeters(text)
    setDraft({ source: parsed ? formatHeightsMeters(parsed) : serialized, text })
    if (parsed && !sameHeights(parsed, value)) onChange(parsed)
  }} onBlur={(event) => {
    const parsed = parseHeightsMeters(event.currentTarget.value)
    if (!parsed) { setDraft({ source: serialized, text: serialized }); return }
    if (!sameHeights(parsed, value)) onChange(parsed)
    setDraft({ source: formatHeightsMeters(parsed), text: formatHeightsMeters(parsed) })
  }} />
}

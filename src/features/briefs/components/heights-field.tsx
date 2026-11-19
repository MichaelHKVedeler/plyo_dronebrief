import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { blurOnEnter } from '@/lib/blur-on-enter'
import { cn } from '@/lib/utils'
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
  return <div className="relative flex min-w-0 flex-1">
    <Input id={id} aria-label={label} placeholder={placeholder} className={cn('w-full', className, 'pr-7')} value={draft.text}
      onChange={(event) => commit(event.currentTarget.value, false)}
      onKeyDown={blurOnEnter}
      onBlur={(event) => commit(event.currentTarget.value, true)} />
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">m</span>
  </div>
}

import { useId, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import type { PersonalCollection } from '../model/cloud'
import { cloudError } from '../auth/firebase'
import { Problem } from './problem'

export function CollectionPicker({ label, collections, value, disabled, onChange, onCreate }: {
  label: string
  collections: PersonalCollection[]
  value: string
  disabled: boolean
  onChange: (id: string) => void
  onCreate: (name: string, id: string) => Promise<void>
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ name: string; id: string } | null>(null)
  const name = search.trim()
  const normalized = name.toLocaleLowerCase()
  const matches = collections.filter((item) => item.name.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => Number(b.name.toLocaleLowerCase() === normalized) - Number(a.name.toLocaleLowerCase() === normalized) || a.name.localeCompare(b.name))
  const exact = matches.some((item) => item.name.toLocaleLowerCase() === normalized)
  function select(next: string) { onChange(next); setOpen(false); setSearch(''); setError(null) }
  async function create() {
    if (!name || exact || disabled) return
    setError(null)
    const request = pending.current?.name === name ? pending.current : { name, id: crypto.randomUUID() }
    pending.current = request
    try { await onCreate(request.name, request.id); select(request.id); pending.current = null }
    catch (error) { setError(cloudError(error)) }
  }
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Popover open={open} onOpenChange={(next) => { if (!disabled) { setOpen(next); setSearch(''); setError(null) } }}>
      <PopoverTrigger asChild><Button id={id} variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between">
        <span className="truncate">{collections.find((item) => item.id === value)?.name ?? 'Uncollected'}</span><ChevronsUpDown />
      </Button></PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command label="Search or add collection" shouldFilter={false}>
          <CommandInput aria-label="Search or add collection" placeholder="Search or add collection…" maxLength={200} value={search} onValueChange={setSearch} disabled={disabled} />
          <CommandList>
            <CommandGroup>
              {matches.map((item) => <CommandItem key={item.id} value={item.id} disabled={disabled} onSelect={() => select(item.id)}><Check className={value === item.id ? '' : 'invisible'} /><span className="min-w-0 break-words">{item.name}</span></CommandItem>)}
              {!name && <CommandItem value="uncollected" disabled={disabled} onSelect={() => select('')}><Check className={!value ? '' : 'invisible'} />Uncollected</CommandItem>}
              {name && !exact && <CommandItem value="add-collection" disabled={disabled} onSelect={() => void create()}><Plus /><span className="min-w-0 break-words">{disabled ? 'Creating…' : `Add ${name}`}</span></CommandItem>}
            </CommandGroup>
          </CommandList>
        </Command>
        {error && <div className="p-2"><Problem message={error} /></div>}
      </PopoverContent>
    </Popover>
  </div>
}

import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BriefHeaderTitle({ name, clientName, mode, onUpdate }: {
  name: string
  clientName: string
  mode: 'edit' | 'view'
  onUpdate?: (patch: { name?: string; clientName?: string }) => void
}) {
  const canEdit = mode === 'edit'
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(name)
  const [clientDraft, setClientDraft] = useState(clientName)
  const nameRef = useRef<HTMLInputElement>(null)
  const editingRef = useRef(false)

  useEffect(() => {
    if (editing) nameRef.current?.focus()
  }, [editing])

  function startEditing() {
    if (!canEdit || editingRef.current) return
    editingRef.current = true
    setNameDraft(name)
    setClientDraft(clientName)
    setEditing(true)
  }

  function finishEditing(commit: boolean, data?: FormData) {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    if (!commit || !data) return
    const nextName = String(data.get('project') ?? '').trim() || name
    const nextClient = String(data.get('client') ?? '').trim() || clientName
    const patch: { name?: string; clientName?: string } = {}
    if (nextName !== name) patch.name = nextName
    if (nextClient !== clientName) patch.clientName = nextClient
    if (Object.keys(patch).length) onUpdate?.(patch)
  }

  if (!canEdit || !editing) {
    return (
      <div className={`group/title flex min-w-0 items-center justify-center gap-2 ${canEdit ? 'cursor-pointer' : ''}`} onClick={startEditing}>
        <h1 className="min-w-0 truncate text-base leading-5 font-semibold tracking-tight" title={name}>{name}</h1>
        <p className="min-w-0 truncate text-sm leading-5 text-muted-foreground" title={clientName}>{clientName}</p>
        {canEdit && <Button type="button" variant="ghost" size="icon-xs" className="opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-within/title:opacity-100" aria-label="Edit title" onClick={(event) => { event.stopPropagation(); startEditing() }}>
          <Pencil />
        </Button>}
      </div>
    )
  }

  return (
    <form
      className="flex min-w-0 max-w-full items-center justify-center gap-2"
      onSubmit={(event) => { event.preventDefault(); finishEditing(true, new FormData(event.currentTarget)) }}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        finishEditing(true, new FormData(event.currentTarget))
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); finishEditing(false) } }}
    >
      <Input
        ref={nameRef}
        name="project"
        aria-label="Project name"
        value={nameDraft}
        maxLength={200}
        placeholder="Project name"
        className="h-8 w-52 min-w-0 md:text-sm"
        onChange={(event) => setNameDraft(event.target.value)}
      />
      <Input
        name="client"
        aria-label="Client name"
        value={clientDraft}
        maxLength={200}
        placeholder="Client name"
        className="h-8 w-40 min-w-0 md:text-sm"
        onChange={(event) => setClientDraft(event.target.value)}
      />
    </form>
  )
}

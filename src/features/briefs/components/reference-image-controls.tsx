import { useRef, useState } from 'react'
import { ImagePlus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { BriefReference, DroneBrief } from '../model/brief'
import type { LocalImages } from '../state/use-local-images'
import { imagePicker, type LocalImageHandle } from '../storage/local-images'

export function ReferenceImageControls({ references, editable, images, onUpdate }: {
  references: BriefReference[]
  editable: boolean
  images: LocalImages
  onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const reconnect = useRef<BriefReference | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ url: string; caption: string } | null>(null)
  async function accept(file: File, handle?: LocalImageHandle) {
    setBusy(true); setError('')
    try {
      const existing = reconnect.current
      if (!existing && !editable) return
      const source = existing?.source
      const fileId = source && typeof source !== 'string' ? source.fileId : crypto.randomUUID()
      await images.connect(fileId, file, handle)
      if (!existing) {
        const caption = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Reference'
        const reference: BriefReference = { id: crypto.randomUUID(), caption, source: { kind: 'local-file', fileId, fileName: file.name } }
        onUpdate((brief) => ({ ...brief, references: [...brief.references, reference] }))
      } else if (editable) {
        const existingId = existing.id
        onUpdate((brief) => ({ ...brief, references: brief.references.map((item) => item.id === existingId ? { ...item, source: { kind: 'local-file', fileId, fileName: file.name } } : item) }))
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be opened.') }
    finally { setBusy(false); reconnect.current = null }
  }
  async function choose(existing: BriefReference | null = null) {
    reconnect.current = existing; setError('')
    const picker = imagePicker()
    if (!picker) { input.current?.click(); return }
    setBusy(true)
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: 'JPG or PNG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] } }] })
      if (handle) await accept(await handle.getFile(), handle)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) input.current?.click()
    } finally { setBusy(false) }
  }
  function commitCaption(reference: BriefReference, value: string) {
    const caption = value.trim().slice(0, 200)
    if (!caption || caption === reference.caption) return
    onUpdate((brief) => ({ ...brief, references: brief.references.map((item) => item.id === reference.id ? { ...item, caption } : item) }))
  }
  return <div className="grid min-w-0 gap-3">
    <Input ref={input} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" aria-label="Reference image file" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void accept(file)
    }} />
    {editable && references.length < 4 && <Button variant="outline" disabled={busy} onClick={() => void choose()}><ImagePlus />{busy ? 'Opening image…' : 'Upload reference'}</Button>}
    {editable && references.length >= 4 && <p className="text-xs text-muted-foreground">Maximum 4 reference images per brief.</p>}
    {busy && images.cloud && <Button variant="outline" onClick={() => images.cancel()}>Cancel upload</Button>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {references.length === 0 && !editable && <p className="text-sm text-muted-foreground">No reference images.</p>}
    {references.map((reference) => {
      const resource = typeof reference.source === 'string' ? undefined : images.resources[reference.source.fileId]
      const url = images.sourceUrl(reference)
      return <div key={reference.id} className="grid min-w-0 gap-2 rounded-md border p-3">
        <div className="relative overflow-hidden rounded-md border bg-white">
          <Button variant="ghost" className="h-auto min-h-40 w-full rounded-none p-0 hover:bg-transparent" aria-label="View reference" disabled={!url}
            onClick={() => { if (url) setPreview({ url, caption: reference.caption }) }}>
            {url ? <img src={url} alt="" className="aspect-[4/3] w-full object-contain" /> : <span className="p-8 text-sm text-muted-foreground">Reference image unavailable</span>}
          </Button>
          {editable && <>
            <Button size="icon-sm" variant="outline" className="absolute top-2 right-2 border-zinc-700 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" disabled={busy} aria-label={`Remove ${reference.caption}`} title="Remove reference"
              onClick={() => onUpdate((brief) => ({ ...brief, references: brief.references.filter((item) => item.id !== reference.id) }))}><X /></Button>
            <Button size="icon-sm" variant="outline" className="absolute right-2 bottom-2 border-zinc-700 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" disabled={busy} aria-label="Replace reference" title="Replace reference" onClick={() => void choose(reference)}><RefreshCw /></Button>
          </>}
        </div>
        {editable
          ? <div className="grid gap-2"><Label htmlFor={`reference-caption-${reference.id}`}>Caption</Label>
            <Input id={`reference-caption-${reference.id}`} key={reference.id + reference.caption} defaultValue={reference.caption} maxLength={200}
              onBlur={(event) => commitCaption(reference, event.target.value)} /></div>
          : <p className="text-sm font-medium">{reference.caption}</p>}
        {typeof reference.source !== 'string' && <p className="break-all text-xs text-muted-foreground">{reference.source.fileName}</p>}
        {resource?.message && <p className="text-xs text-muted-foreground">{resource.message}</p>}
        {!url && images.cloud && typeof reference.source !== 'string' && <Button size="sm" variant="outline" onClick={() => { if (typeof reference.source !== 'string') images.retry(reference.source.fileId) }}>Retry reference</Button>}
        {!url && !images.cloud && typeof reference.source !== 'string' && <div className="flex flex-wrap gap-2">
          {resource?.handle && <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            if (typeof reference.source === 'string' || !resource.handle) return
            setBusy(true); setError('')
            try { await images.allow(reference.source.fileId, resource.handle) } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
          }}>Allow file access</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(reference)}>Reconnect reference</Button>
        </div>}
      </div>
    })}
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}><DialogContent aria-describedby={undefined} className="sm:max-w-4xl"><DialogHeader><DialogTitle>{preview?.caption}</DialogTitle></DialogHeader>{preview && <img src={preview.url} alt={preview.caption} className="max-h-[70dvh] w-full rounded-md bg-white object-contain" />}</DialogContent></Dialog>
  </div>
}

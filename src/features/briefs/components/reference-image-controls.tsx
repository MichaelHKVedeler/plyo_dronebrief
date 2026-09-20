import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      if (existing && typeof source === 'string') return
      const fileId = source && typeof source !== 'string' ? source.fileId : crypto.randomUUID()
      await images.connect(fileId, file, handle)
      if (!existing) {
        const caption = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Reference'
        const reference: BriefReference = { id: crypto.randomUUID(), caption, source: { kind: 'local-file', fileId, fileName: file.name } }
        onUpdate((brief) => ({ ...brief, references: [...brief.references, reference] }))
      } else if (images.cloud && editable) {
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
    {editable && <Button variant="outline" disabled={busy || references.length >= 4} onClick={() => void choose()}><ImagePlus />{busy ? 'Opening image…' : 'Upload reference'}</Button>}
    {editable && references.length >= 4 && <p className="text-xs text-muted-foreground">Maximum 4 reference images per brief.</p>}
    {busy && images.cloud && <Button variant="outline" onClick={() => images.cancel()}>Cancel upload</Button>}
    <p className="text-xs text-muted-foreground">{images.description ?? 'JPG or PNG, up to 4 images. These are included in PDF export and the public briefing link.'}</p>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {references.length === 0 && !editable && <p className="text-sm text-muted-foreground">No reference images.</p>}
    {references.map((reference) => {
      const resource = typeof reference.source === 'string' ? undefined : images.resources[reference.source.fileId]
      const url = images.sourceUrl(reference)
      return <div key={reference.id} className="grid min-w-0 gap-2 rounded-md border p-3">
        {editable
          ? <div className="grid gap-2"><Label htmlFor={`reference-caption-${reference.id}`}>Caption</Label>
            <Input id={`reference-caption-${reference.id}`} key={reference.id + reference.caption} defaultValue={reference.caption} maxLength={200}
              onBlur={(event) => commitCaption(reference, event.target.value)} /></div>
          : <p className="text-sm font-medium">{reference.caption}</p>}
        {typeof reference.source !== 'string' && <p className="break-all text-xs text-muted-foreground">{reference.source.fileName}</p>}
        {resource?.message && <p className="text-xs text-muted-foreground">{resource.message}</p>}
        {url && <Button size="sm" variant="outline" onClick={() => setPreview({ url, caption: reference.caption })}>View reference</Button>}
        {images.cloud && editable && typeof reference.source !== 'string' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(reference)}>Replace reference</Button>}
        {!url && images.cloud && typeof reference.source !== 'string' && <Button size="sm" variant="outline" onClick={() => { if (typeof reference.source !== 'string') images.retry(reference.source.fileId) }}>Retry reference</Button>}
        {!url && !images.cloud && typeof reference.source !== 'string' && <div className="flex flex-wrap gap-2">
          {resource?.handle && <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            if (typeof reference.source === 'string' || !resource.handle) return
            setBusy(true); setError('')
            try { await images.allow(reference.source.fileId, resource.handle) } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
          }}>Allow file access</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(reference)}>Reconnect reference</Button>
        </div>}
        {editable && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${reference.caption}`} onClick={() => onUpdate((brief) => ({ ...brief, references: brief.references.filter((item) => item.id !== reference.id) }))}><Trash2 /></Button>}
      </div>
    })}
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{preview?.caption}</DialogTitle><DialogDescription>Reference image included in the PDF and public briefing.</DialogDescription></DialogHeader>{preview && <img src={preview.url} alt={preview.caption} className="max-h-[70dvh] w-full rounded-md bg-white object-contain" />}</DialogContent></Dialog>
  </div>
}

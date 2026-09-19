import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DroneBrief, ImageOverlay, Position } from '../model/brief'
import type { LocalImages } from '../state/use-local-images'
import { imagePicker, type LocalImageHandle } from '../storage/local-images'

export type ImageControlsProps = {
  images: LocalImages; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
  placement: () => { position: Position; radiusMeters: number }
  selectedId: string | null; onSelect: (id: string | null) => void
  onShow: () => void
}
export function ImageOverlayControls({ overlays, editable, images, onUpdate, placement, selectedId, onSelect, onShow }: ImageControlsProps & { overlays: ImageOverlay[]; editable: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const reconnect = useRef<ImageOverlay | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  async function accept(file: File, handle?: LocalImageHandle) {
    setBusy(true); setError('')
    try {
      const existing = reconnect.current
      if (!existing && !editable) return
      const source = existing?.source
      if (existing && typeof source === 'string') return
      const fileId = source && typeof source !== 'string' ? source.fileId : crypto.randomUUID()
      const image = await images.connect(fileId, file, handle)
      if (!existing) {
        const { position, radiusMeters } = placement()
        const longest = Math.min(10000, radiusMeters * 2)
        const overlay: ImageOverlay = {
          id: crypto.randomUUID(), name: file.name.slice(0, 200), source: { kind: 'local-file', fileId, fileName: file.name },
          position, widthMeters: longest * image.width / Math.max(image.width, image.height), heightMeters: longest * image.height / Math.max(image.width, image.height), rotationDegrees: 0, opacity: 0.7,
        }
        onUpdate((brief) => ({ ...brief, imageOverlays: [...brief.imageOverlays, overlay] }))
        onSelect(overlay.id); onShow()
      } else if (images.cloud && editable) {
        const existingId = existing.id
        onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.map((overlay) => overlay.id === existingId ? { ...overlay, source: { kind: 'local-file', fileId, fileName: file.name } } : overlay) }))
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be opened.') }
    finally { setBusy(false); reconnect.current = null }
  }
  async function choose(existing: ImageOverlay | null = null) {
    reconnect.current = existing; setError('')
    const picker = imagePicker()
    if (!picker) { input.current?.click(); return }
    setBusy(true)
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: 'JPG or PNG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] } }] })
      if (handle) await accept(await handle.getFile(), handle)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        // Some embedded browsers expose the picker but cannot open it.
        input.current?.click()
      }
    } finally { setBusy(false) }
  }
  return <div className="grid min-w-0 gap-3">
    <Input ref={input} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" aria-label="Local image file" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void accept(file)
    }} />
    {editable && <Button variant="outline" disabled={busy || overlays.length >= 10} onClick={() => void choose()}><ImagePlus />{busy ? 'Opening image…' : 'Upload image'}</Button>}
    {editable && overlays.length >= 10 && <p className="text-xs text-muted-foreground">Maximum 10 images per brief.</p>}
    {busy && images.cloud && <Button variant="outline" onClick={() => images.cancel()}>Cancel upload</Button>}
    <p className="text-xs text-muted-foreground">{images.description ?? 'JPG or PNG. Images stay on your device. Your browser remembers the file when supported; otherwise reconnect it after reopening.'}</p>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {overlays.map((overlay) => {
      const resource = typeof overlay.source === 'string' ? undefined : images.resources[overlay.source.fileId]
      const value = Math.round((images.opacityOverrides[overlay.id] ?? overlay.opacity) * 100)
      return <div key={overlay.id} className="grid min-w-0 gap-2 rounded-md border p-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant={selectedId === overlay.id ? 'secondary' : 'ghost'} className="min-w-0 flex-1 justify-start px-2" title={overlay.name} aria-pressed={selectedId === overlay.id} onClick={() => { onSelect(overlay.id); onShow() }}><span className="truncate">{overlay.name}</span></Button>
          {editable && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${overlay.name}`} onClick={() => { onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.filter((image) => image.id !== overlay.id) })); if (selectedId === overlay.id) onSelect(null) }}><Trash2 /></Button>}
        </div>
        {typeof overlay.source !== 'string' && <>
          <p className="break-all text-xs text-muted-foreground">{overlay.source.fileName}</p>
          {resource?.message && <p className="text-xs text-muted-foreground">{resource.message}</p>}
          {resource?.url && <Button size="sm" variant="outline" onClick={() => setPreview({ url: resource.url!, name: overlay.name })}>View floorplan</Button>}
          {images.cloud && editable && <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(overlay)}>Replace floorplan</Button>}
          {!resource?.url && images.cloud && <Button size="sm" variant="outline" onClick={() => { if (typeof overlay.source !== 'string') images.retry(overlay.source.fileId) }}>Retry floorplan</Button>}
          {!resource?.url && !images.cloud && <div className="flex flex-wrap gap-2">
            {resource?.handle && <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
              if (typeof overlay.source === 'string' || !resource.handle) return
              setBusy(true); setError('')
              try { await images.allow(overlay.source.fileId, resource.handle) } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
            }}>Allow file access</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(overlay)}>Reconnect image</Button>
          </div>}
        </>}
        <Label htmlFor={`image-opacity-${overlay.id}`}>Visibility <span className="ml-auto tabular-nums">{value}%</span></Label>
        <Slider id={`image-opacity-${overlay.id}`} value={[value]} min={0} max={100} step={1} disabled={!editable}
          thumbProps={{ 'aria-label': `${overlay.name} visibility` }}
          onValueChange={([value]) => images.previewOpacity(overlay.id, value / 100)}
          onValueCommit={([value]) => { onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.map((image) => image.id === overlay.id ? { ...image, opacity: value / 100 } : image) })); images.previewOpacity(overlay.id) }} />
      </div>
    })}
    {editable && overlays.length > 0 && <p className="text-xs leading-relaxed text-muted-foreground">Drag an image edge to move it. Right-click anywhere on the map to set the selected image’s anchor. Drag inside the image to rotate and scale together. Escape cancels a drag.</p>}
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>Floorplan preview on white paper. Position and scale on the map are unchanged.</DialogDescription></DialogHeader>{preview && <img src={preview.url} alt={preview.name} className="max-h-[70dvh] w-full rounded-md bg-white object-contain" />}</DialogContent></Dialog>
  </div>
}

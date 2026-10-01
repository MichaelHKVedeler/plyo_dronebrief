import { useRef, useState } from 'react'
import { ImagePlus, Lock, LockOpen, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FloorplanMaskViewer } from './floorplan-mask-viewer'
import { maskClipPath } from '../model/image-mask'
import type { DroneBrief, ImageOverlay, Position } from '../model/brief'
import type { LocalImages } from '../state/use-local-images'
import { imagePicker, type LocalImageHandle } from '../storage/local-images'

export type ImageControlsProps = {
  images: LocalImages; onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
  placement: () => { position: Position; radiusMeters: number }
  selectedId: string | null; onSelect: (id: string | null) => void
  lockedIds: ReadonlySet<string>; onToggleLock: (id: string) => void
  onShow: () => void
}
export function ImageOverlayControls({ overlays, editable, images, onUpdate, placement, selectedId, onSelect, onShow, lockedIds, onToggleLock }: ImageControlsProps & { overlays: ImageOverlay[]; editable: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const reconnect = useRef<ImageOverlay | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const previewOverlay = overlays.find((overlay) => overlay.id === preview)
  const previewUrl = previewOverlay ? images.sourceUrl(previewOverlay) : undefined
  async function accept(file: File, handle?: LocalImageHandle) {
    setBusy(true); setError('')
    try {
      const existing = reconnect.current
      if (!existing && !editable) return
      const source = existing?.source
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
      } else if (editable) {
        const existingId = existing.id
        onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.map((overlay) => overlay.id === existingId ? { ...overlay, name: file.name.slice(0, 200), source: { kind: 'local-file', fileId, fileName: file.name } } : overlay) }))
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
    {editable && overlays.length === 0 && <Button variant="outline" disabled={busy} onClick={() => void choose()}><ImagePlus />{busy ? 'Opening image…' : 'Upload image'}</Button>}
    {busy && images.cloud && <Button variant="outline" onClick={() => images.cancel()}>Cancel upload</Button>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {overlays.map((overlay) => {
      const resource = typeof overlay.source === 'string' ? undefined : images.resources[overlay.source.fileId]
      const url = images.sourceUrl(overlay)
      const value = Math.round((images.opacityOverrides[overlay.id] ?? overlay.opacity) * 100)
      return <div key={overlay.id} className="grid min-w-0 gap-2 rounded-md border p-3">
        <div className="relative overflow-hidden rounded-md border bg-white">
          <Button variant="ghost" className="h-auto min-h-40 w-full rounded-none p-0 hover:bg-transparent" aria-label="View floorplan" disabled={!url}
            onClick={() => { onSelect(overlay.id); onShow(); if (url) setPreview(overlay.id) }}>
            {url ? <img src={url} alt="" className="w-full" style={{ clipPath: maskClipPath(overlay.mask) }} /> : <span className="p-8 text-sm text-muted-foreground">Floorplan unavailable</span>}
          </Button>
          {editable && <>
            <Button size="icon-sm" variant="outline" className="absolute top-2 right-2 border-zinc-700 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" disabled={busy} aria-label={`Remove ${overlay.name}`} title="Remove floorplan"
              onClick={() => { onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.filter((image) => image.id !== overlay.id) })); if (selectedId === overlay.id) onSelect(null) }}><X /></Button>
            <Button size="icon-sm" variant="outline" className="absolute bottom-2 left-2 border-zinc-700 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" aria-pressed={lockedIds.has(overlay.id)} aria-label={`${lockedIds.has(overlay.id) ? 'Unlock' : 'Lock'} floorplan ${overlay.name}`} title={lockedIds.has(overlay.id) ? 'Unlock floorplan' : 'Lock floorplan'} onClick={() => onToggleLock(overlay.id)}>
              {lockedIds.has(overlay.id) ? <Lock /> : <LockOpen />}
            </Button>
            <Button size="icon-sm" variant="outline" className="absolute right-2 bottom-2 border-zinc-700 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" disabled={busy} aria-label="Replace floorplan" title="Replace floorplan" onClick={() => void choose(overlay)}><RefreshCw /></Button>
          </>}
        </div>
        {typeof overlay.source !== 'string' && <>
          <p className="break-all text-xs text-muted-foreground">{overlay.source.fileName}</p>
          {resource?.message && <p className="text-xs text-muted-foreground">{resource.message}</p>}
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
        <Label htmlFor={`image-opacity-${overlay.id}`}>Opacity <span className="ml-auto tabular-nums">{value}%</span></Label>
        <Slider id={`image-opacity-${overlay.id}`} value={[value]} min={0} max={100} step={1} disabled={!editable}
          thumbProps={{ 'aria-label': `${overlay.name} opacity` }}
          onValueChange={([value]) => images.previewOpacity(overlay.id, value / 100)}
          onValueCommit={([value]) => { onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.map((image) => image.id === overlay.id ? { ...image, opacity: value / 100 } : image) })); images.previewOpacity(overlay.id) }} />
      </div>
    })}
    <Dialog open={Boolean(previewOverlay)} onOpenChange={(open) => { if (!open) setPreview(null) }}><DialogContent onEscapeKeyDown={(event) => { if (document.querySelector('[data-mask-busy="true"]')) event.preventDefault() }} aria-describedby={undefined} className="max-h-[95dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{previewOverlay?.name}</DialogTitle></DialogHeader>
      {previewOverlay && previewUrl && <FloorplanMaskViewer key={previewOverlay.id} overlay={previewOverlay} url={previewUrl} editable={editable} onChange={(mask) => {
        const id = previewOverlay.id
        onUpdate((brief) => ({ ...brief, imageOverlays: brief.imageOverlays.map((image) => image.id === id ? { ...image, mask } : image) }))
      }} />}
    </DialogContent></Dialog>
  </div>
}

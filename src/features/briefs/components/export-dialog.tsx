import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { ExportQr } from './export-qr'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ExportDialog({ shareKey, onClose, hasLocalImages = false }: { shareKey: string | null; onClose: () => void; hasLocalImages?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  return <Dialog open={shareKey !== null} onOpenChange={(open) => { if (!open) { setCopied(false); setError(''); onClose() } }}>
    <DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Share this brief</DialogTitle></DialogHeader>
      <div className="grid gap-2"><Label htmlFor="export-key">Export key</Label><Textarea id="export-key" readOnly value={shareKey ?? ''} className="max-h-48 min-h-32 break-all font-mono text-xs" onFocus={(event) => event.target.select()} /></div>
      {hasLocalImages && <p className="text-sm text-muted-foreground">Local images are not included in this key. Their placement is saved; reconnect the matching files to display them on another device.</p>}
      <Button onClick={async () => {
        try { await navigator.clipboard.writeText(shareKey ?? ''); setCopied(true); setError('') }
        catch { setError('Copy is unavailable here. Select the key and copy it manually.') }
      }}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy key'}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {shareKey && <ExportQr key={shareKey} shareKey={shareKey} />}
    </DialogContent>
  </Dialog>
}

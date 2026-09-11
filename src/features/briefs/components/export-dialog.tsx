import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ExportDialog({ shareKey, onClose }: { shareKey: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  return <Dialog open={shareKey !== null} onOpenChange={(open) => { if (!open) { setCopied(false); setError(''); onClose() } }}>
    <DialogContent><DialogHeader><DialogTitle>Share this brief</DialogTitle><DialogDescription>Copy this snapshot key. Anyone with the key can load a read-only view. Later edits need a new export.</DialogDescription></DialogHeader>
      <div className="grid gap-2"><Label htmlFor="export-key">Export key</Label><Textarea id="export-key" readOnly value={shareKey ?? ''} className="max-h-48 min-h-32 break-all font-mono text-xs" onFocus={(event) => event.target.select()} /></div>
      <Button onClick={async () => {
        try { await navigator.clipboard.writeText(shareKey ?? ''); setCopied(true); setError('') }
        catch { setError('Copy is unavailable here. Select the key and copy it manually.') }
      }}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy key'}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>
}

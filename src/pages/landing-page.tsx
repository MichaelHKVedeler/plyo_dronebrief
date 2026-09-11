import { useState } from 'react'
import { FolderOpen, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { importBriefKey } from '@/features/briefs/storage/share-key'
import type { DroneBrief } from '@/features/briefs/model/brief'

type Props = { onCreate: () => void; onLoad: (brief: DroneBrief) => void; onResume: () => void; draft: DroneBrief | null; error: string | null }
export function LandingPage({ onCreate, onLoad, onResume, draft, error }: Props) {
  const [loadOpen, setLoadOpen] = useState(false)
  const [key, setKey] = useState('')
  const [loadError, setLoadError] = useState('')
  return <main className="mx-auto flex min-h-[calc(100svh-70px)] max-w-3xl flex-col justify-center gap-7 px-6 py-12">
    <div><h1 className="text-3xl font-semibold tracking-tight">Plan your next shoot.</h1><p className="mt-3 text-muted-foreground">Create a drone brief or open one shared with you.</p></div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardHeader><CardTitle>New brief</CardTitle><CardDescription>Start with the project and shoot schedule.</CardDescription></CardHeader><CardContent><Button onClick={onCreate}><Plus /> Create a brief</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Open a brief</CardTitle><CardDescription>Paste an export key to open a read-only view.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => setLoadOpen(true)}><FolderOpen /> Load a brief</Button></CardContent></Card>
    </div>
    {draft && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div><p className="text-sm text-muted-foreground">Last draft on this device</p><p className="font-medium">{draft.project.name}</p></div>
      <Button variant="ghost" onClick={onResume}><RotateCcw /> Resume editing</Button>
    </div>}
    <Dialog open={loadOpen} onOpenChange={setLoadOpen}><DialogContent>
      <DialogHeader><DialogTitle>Load a brief</DialogTitle><DialogDescription>You can explore the map and toggle layers. The brief stays read-only.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={(event) => {
        event.preventDefault()
        try { onLoad(importBriefKey(key)) } catch (error) { setLoadError((error as Error).message) }
      }}>
        <div className="grid gap-2"><Label htmlFor="share-key">Export key</Label><Textarea id="share-key" placeholder="DB2.…" value={key} onChange={(event) => { setKey(event.target.value); setLoadError('') }} required className="max-h-48 min-h-28 break-all font-mono" /></div>
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        <Button type="submit">Open read-only brief</Button>
      </form>
    </DialogContent></Dialog>
  </main>
}

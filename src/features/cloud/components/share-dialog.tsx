import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { callCloud, cloudError } from '../auth/firebase'
import { Problem } from './problem'

function projectLink(path: string) { return `${location.origin}${location.pathname}${location.search}#${path}` }
export function ShareDialog({ projectId, canManage, onClose }: { projectId: string; canManage: boolean; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [copied, setCopied] = useState('')
  useEffect(() => {
    if (!canManage) return
    let active = true
    void callCloud<{ token: string | null }>('share', { projectId, action: 'status' }).then((result) => { if (active) setToken(result.token) }).catch((error) => { if (active) setError(cloudError(error)) })
    return () => { active = false }
  }, [projectId, canManage])
  async function copy(link: string) { try { await navigator.clipboard.writeText(link); setCopied('Link copied.'); setError(null) } catch { setError('Copy is unavailable. Select the link and copy it manually.') } }
  async function change(action: 'enable' | 'revoke') {
    setBusy(true); setError(null); setCopied('')
    try { const result = await callCloud<{ token: string | null }>('share', { projectId, action }); setToken(result.token); if (result.token) await copy(projectLink(`/s/${result.token}`)) }
    catch (error) { setError(cloudError(error)) } finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent><DialogHeader><DialogTitle>Share live project</DialogTitle><DialogDescription>Links open the latest saved version. Portable snapshot exports are separate, frozen copies.</DialogDescription></DialogHeader><Problem message={error} />
    <Label htmlFor="member-link">Organization link · sign-in required</Label><Input id="member-link" readOnly value={projectLink(`/projects/${projectId}`)} onFocus={(event) => event.target.select()} /><Button onClick={() => void copy(projectLink(`/projects/${projectId}`))}>Copy project link</Button>
    {canManage && <><p className="text-sm">Public viewing shares the complete brief, floorplans, and creator/editor display names with anyone holding the link. No sign-in is required.</p>{token ? <><Label htmlFor="public-link">Public read-only link</Label><Input id="public-link" readOnly value={projectLink(`/s/${token}`)} onFocus={(event) => event.target.select()} /><Button onClick={() => void copy(projectLink(`/s/${token}`))}>Copy public link</Button><Button variant="outline" disabled={busy} onClick={() => void change('revoke')}>Revoke public link</Button></> : <Button disabled={busy} onClick={() => void change('enable')}>Enable public viewing and copy link</Button>}</>}
    {copied && <p role="status">{copied}</p>}
  </DialogContent></Dialog>
}

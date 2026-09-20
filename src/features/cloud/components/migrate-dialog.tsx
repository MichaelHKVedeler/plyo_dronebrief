import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'
import { readImageHandle } from '@/features/briefs/storage/local-images'
import { localFileSources, type DroneBrief } from '@/features/briefs/model/brief'
import type { AssetManifest, Organization, PersonalCollection } from '../model/cloud'
import { cloudLibrary } from '../storage/library-repository'
import { cloudProjects } from '../storage/project-repository'
import { uploadFloorplan } from '../storage/uploads'
import { cloudError } from '../auth/firebase'
import { Choice } from './choice'
import { Problem } from './problem'
import { loadMigration, saveMigration } from '../storage/migration-repository'

export function MigrateDialog({ brief, organizations, uid, onDirty, onClose, onSaved }: { brief: DroneBrief; organizations: Organization[]; uid: string; onDirty: (dirty: boolean) => void; onClose: () => void; onSaved: (id: string) => void }) {
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '')
  const [collections, setCollections] = useState<PersonalCollection[]>([]); const [collectionId, setCollectionId] = useState('')
  const [files, setFiles] = useState<Record<string, File>>({}); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const uploaded = useRef<AssetManifest>({}); const controller = useRef(new AbortController())
  const images = localFileSources(brief).map((source) => ({ id: source.fileId, name: source.fileName }))
  useEffect(() => { controller.current = new AbortController(); return () => controller.current.abort() }, [])
  useEffect(() => { onDirty(busy); return () => onDirty(false) }, [busy, onDirty])
  useEffect(() => {
    let active = true
    void cloudLibrary.collections(orgId).then((result) => { if (active) setCollections(result.collections) }).catch((error) => { if (active) setError(cloudError(error)) })
    return () => { active = false }
  }, [orgId])
  async function save() {
    setBusy(true); setError(null); controller.current = new AbortController()
    try {
      const { key, recovery } = await loadMigration(uid, orgId, brief)
      uploaded.current = recovery.assets
      if (recovery.complete && recovery.projectId) { await cloudProjects.load(recovery.projectId); controller.current.signal.throwIfAborted(); onSaved(recovery.projectId); return }
      if (recovery.projectId) setStarted(true)
      const resolved = { ...files }
      for (const image of images) if (!resolved[image.id] && !uploaded.current[image.id]) {
        const handle = await readImageHandle(image.id)
        if (!handle || await handle.queryPermission({ mode: 'read' }) !== 'granted') throw new Error(`Choose ${image.name} below before saving this draft.`)
        resolved[image.id] = await handle.getFile()
      }
      setStatus('Creating cloud project…')
      const seed = reduceSession(openSession(brief, 'edit'), { type: 'update', update: (value) => ({
        ...value,
        imageOverlays: value.imageOverlays.filter((image) => typeof image.source === 'string'),
        references: value.references.filter((image) => typeof image.source === 'string'),
      }) }).brief
      const target = recovery.projectId ? await cloudProjects.load(recovery.projectId) : await cloudProjects.create(orgId, seed, recovery.operationId)
      if (!recovery.projectId) { recovery.projectId = target.summary.id; recovery.baseRevision = target.summary.revision; saveMigration(key, recovery) }
      setStarted(true)
      for (const image of images) if (!uploaded.current[image.id]) {
        uploaded.current[image.id] = await uploadFloorplan(target.summary.id, image.id, resolved[image.id], setStatus, controller.current.signal)
        recovery.assets = uploaded.current; saveMigration(key, recovery)
      }
      controller.current.signal.throwIfAborted(); setStatus('Saving project…')
      if (!recovery.payload) { recovery.payload = reduceSession(openSession(target.brief, 'edit'), { type: 'update', update: () => structuredClone(brief) }).brief; saveMigration(key, recovery) }
      await cloudProjects.save(target.summary.id, recovery.baseRevision, recovery.saveOperationId, recovery.payload, recovery.assets)
      controller.current.signal.throwIfAborted()
      if (collectionId) await cloudLibrary.assign(orgId, target.summary.id, collectionId)
      recovery.complete = true; saveMigration(key, recovery)
      controller.current.signal.throwIfAborted()
      onSaved(target.summary.id)
    } catch (error) { setError(cloudError(error)) } finally { setBusy(false); setStatus('') }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Save {brief.project.name} to an organization</DialogTitle><DialogDescription>The local draft stays on this device. Floorplans will be uploaded and optimized; select any files the browser can no longer access.</DialogDescription></DialogHeader><Problem message={error} />
    <Choice label="Organization" disabled={busy || started} value={orgId} onChange={(id) => { setOrgId(id); setCollectionId('') }} options={organizations.map((org) => ({ value: org.id, label: org.name }))} />
    <Choice label="My collection" disabled={busy} value={collectionId} onChange={setCollectionId} options={[{ value: '', label: 'Uncollected' }, ...collections.map((item) => ({ value: item.id, label: item.name }))]} />
    {images.map((image) => <div className="grid gap-1" key={image.id}><Label htmlFor={`migrate-${image.id}`}>{image.name}</Label><Input id={`migrate-${image.id}`} type="file" disabled={busy} accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) setFiles((previous) => ({ ...previous, [image.id]: file })) }} /></div>)}
    {status && <p role="status">{status}</p>}<Button disabled={busy || !orgId} onClick={() => void save()}>Save local draft to organization</Button>{busy && <Button variant="outline" onClick={() => controller.current.abort()}>Cancel upload</Button>}
  </DialogContent></Dialog>
}

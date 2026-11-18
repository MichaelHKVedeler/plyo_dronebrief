import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FileDown } from 'lucide-react'
import { BriefingPage } from '@/pages/briefing-page'
import { defaultBriefingPresentation, defaultOverlaySize, type BriefingPresentation } from '@/features/briefs/storage/public-brief-link'
import { PdfExportDialog, type ExportLink } from '@/features/briefs/components/pdf-export-dialog'
import { AppHeader } from '@/components/layout/app-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BriefHeaderTitle } from '@/features/briefs/components/brief-header-title'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BriefPage } from '@/pages/brief-page'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { openSession, reduceSession, type BriefAction } from '@/features/briefs/state/brief-session'
import { exportBriefKey } from '@/features/briefs/storage/share-key'
import type { ImageTransport } from '@/features/briefs/storage/image-transport'
import { localFileSources } from '@/features/briefs/model/brief'
import type { AssetManifest, CloudProject, Organization } from '../model/cloud'
import { callCloud, cloudError } from '../auth/firebase'
import { cloudProjects, loadPublic, PublicLinkGone } from '../storage/project-repository'
import { downloadFloorplan, uploadFloorplan } from '../storage/uploads'
import { SaveCoordinator, type SaveStatus } from '../state/save-coordinator'
import { Problem } from './problem'

export function exportCloudSnapshot(brief: CloudProject['brief'], onKey: (key: string) => void, onError: (message: string) => void) {
  try { onKey(exportBriefKey(brief)) } catch (error) { onError(cloudError(error)) }
}

/** Saves the brief together with exactly the uploaded images it still uses. */
function saveBrief(coordinator: SaveCoordinator, brief: CloudProject['brief'], assets: AssetManifest) {
  const used = new Set(localFileSources(brief).map((source) => source.fileId))
  coordinator.enqueue(brief, Object.fromEntries(Object.entries(assets).filter(([fileId]) => used.has(fileId))))
}

export function CloudBrief({ initial, publicToken, presentation = defaultBriefingPresentation, organization, uid, onDirty, onOpen, onHome, headerActions }: { initial: CloudProject; publicToken?: string; presentation?: BriefingPresentation; organization?: Organization; uid?: string; onDirty: (dirty: boolean) => void; onOpen: (id: string) => void; onHome: () => void; headerActions?: ReactNode }) {
  const [project, setProject] = useState(initial)
  const [session, setSession] = useState(() => openSession(initial.brief, publicToken ? 'view' : 'edit'))
  const current = useRef(session); const assets = useRef<AssetManifest>(initial.assets)
  const [status, setStatus] = useState<SaveStatus>('Saved'); const [error, setError] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState(''); const [uploading, setUploading] = useState(false)
  const [accessLost, setAccessLost] = useState(false); const [generation, setGeneration] = useState(0)
  const [reloadConfirm, setReloadConfirm] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const pdfMapRef = useRef<PdfMapCapture | null>(null)
  const overlaySizeRef = useRef(defaultOverlaySize)
  const [copying, setCopying] = useState(false); const copyOperation = useRef(crypto.randomUUID())
  const copyRequest = useRef<{ project: CloudProject; brief: CloudProject['brief']; assets: AssetManifest } | null>(null)
  const alive = useRef(true); const observedRevision = useRef(initial.summary.revision); const busy = useRef(false)
  const [coordinator] = useState(() => new SaveCoordinator(initial.summary.revision,
    (pending) => cloudProjects.save(initial.summary.id, pending.expectedRevision, pending.operationId, pending.brief, pending.assets),
    (next, summary, failure, committedAssets) => {
      setStatus(next)
      if (summary) setProject((previous) => ({ ...previous, summary, assets: committedAssets ?? initial.assets }))
      if (failure) setError(cloudError(failure)); else if (next === 'Saved') setError(null)
    }))
  const loadFresh = useCallback(async () => {
    const latest = publicToken ? await loadPublic(publicToken) : await cloudProjects.load(initial.summary.id)
    if (!alive.current) return
    if (publicToken) {
      if (latest.summary.revision !== observedRevision.current) {
        observedRevision.current = latest.summary.revision; assets.current = latest.assets
        const next = openSession(latest.brief, 'view'); current.current = next; setSession(next); setProject(latest); setGeneration((value) => value + 1)
      }
    } else onOpen(initial.summary.id)
  }, [initial.summary.id, publicToken, onOpen])
  useEffect(() => { busy.current = uploading || copying; onDirty(coordinator.dirty || uploading || copying) }, [coordinator, status, uploading, copying, session, onDirty])
  useEffect(() => {
    alive.current = true
    coordinator.attach()
    return () => { alive.current = false; coordinator.dispose(); onDirty(false) }
  }, [coordinator, onDirty])
  useEffect(() => {
    if (publicToken) {
      // Only a revoked link takes the brief away; a failed check (no signal on site) keeps it and tries again.
      const refresh = () => { if (document.visibilityState === 'visible') void loadFresh().catch((error) => { if (alive.current && error instanceof PublicLinkGone) { setError(cloudError(error)); setAccessLost(true) } }) }
      const timer = setInterval(refresh, 30_000); document.addEventListener('visibilitychange', refresh)
      return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
    }
    return cloudProjects.watch(initial.summary.id, (revision) => {
      observedRevision.current = revision
      if (revision <= coordinator.currentRevision) return
      // Decided and done in one step: work started while waiting on the network must not be reloaded away.
      if (coordinator.dirty || coordinator.saving || busy.current) coordinator.remoteRevision(revision)
      else onOpen(initial.summary.id)
    }, (error) => {
      if (!alive.current) return
      setError(cloudError(error)); setAccessLost(true); coordinator.dispose()
      current.current = { ...current.current, mode: 'view' }; setSession(current.current)
    })
  }, [coordinator, initial.summary.id, loadFresh, publicToken, onOpen])
  useEffect(() => {
    if (!publicToken && status === 'Saved' && !busy.current && observedRevision.current > coordinator.currentRevision) onOpen(initial.summary.id)
  }, [status, coordinator, publicToken, onOpen, initial.summary.id])
  const dispatch = (action: BriefAction) => {
    if (!alive.current) return
    const previous = current.current
    const next = reduceSession(previous, action)
    current.current = next; setSession(next)
    if (next.brief !== previous.brief && next.mode === 'edit') saveBrief(coordinator, next.brief, assets.current)
  }
  const transport = useMemo<ImageTransport>(() => ({
    version: (fileId) => project.assets[fileId]?.id,
    description: 'JPG or PNG, up to 30 MB. Cloud copies are resized and compressed. Original files remain on your device and are not archived online.',
    async load(fileId, signal) { const asset = assets.current[fileId]; if (!asset) throw new Error('Image unavailable.'); return downloadFloorplan(asset, publicToken, signal) },
    upload: publicToken ? undefined : async (fileId, file, signal) => {
      try {
        const asset = await uploadFloorplan(initial.summary.id, fileId, file, setUploadStatus, signal); assets.current = { ...assets.current, [fileId]: asset }
        // A replacement keeps its place in the brief, so the brief itself may not change: save the new image anyway.
        const { brief, mode } = current.current
        if (alive.current && mode === 'edit' && localFileSources(brief).some((source) => source.fileId === fileId)) saveBrief(coordinator, brief, assets.current)
      }
      finally { if (alive.current) setUploadStatus('') }
    },
    onBusy: setUploading,
  }), [project.assets, initial.summary.id, publicToken, coordinator])
  async function copyProject() {
    // A retry sends the same brief again, so nothing may change after the first attempt.
    current.current = { ...current.current, mode: 'view' }; setSession(current.current)
    setCopying(true); setError(null)
    try {
      const brief = copyRequest.current?.brief ?? current.current.brief
      if (!copyRequest.current) {
        const empty = reduceSession(openSession(brief, 'edit'), { type: 'update', update: (value) => ({
          ...value,
          imageOverlays: value.imageOverlays.filter((image) => typeof image.source === 'string'),
          references: value.references.filter((image) => typeof image.source === 'string'),
        }) }).brief
        const target = await cloudProjects.create(initial.summary.orgId, empty, copyOperation.current)
        if (!alive.current) return
        copyRequest.current = { project: target, brief, assets: {} }
      }
      const { project: target, assets: copied } = copyRequest.current
      for (const source of localFileSources(brief)) {
        if (!alive.current) return
        if (copied[source.fileId]) continue
        const asset = assets.current[source.fileId]
        if (!asset) throw new Error('Reconnect or upload missing images before copying.')
        copied[source.fileId] = await callCloud('copyAsset', { projectId: target.summary.id, sourceProjectId: initial.summary.id, assetId: asset.id })
      }
      if (!alive.current) return
      await cloudProjects.save(target.summary.id, target.summary.revision, copyOperation.current, brief, copied)
      if (alive.current) { onDirty(false); onOpen(target.summary.id) }
    } catch (error) { if (alive.current) setError(cloudError(error)) } finally { if (alive.current) setCopying(false) }
  }
  const canManage = organization?.role === 'admin' || project.summary.createdBy.uid === uid
  const exportLink: ExportLink | undefined = publicToken ? undefined : canManage
    ? { status: 'ready', createToken: async () => {
      const result = await callCloud<{ token: string | null }>('share', { projectId: project.summary.id, action: 'enable' })
      if (!result.token) throw new Error('A public link could not be created.')
      return result.token
    } }
    : { status: 'unavailable', reason: 'member' }
  if (publicToken) {
    return accessLost
      ? <div className="grid gap-3 p-6"><Problem message={error ?? 'Project access is no longer available.'} /><Button variant="outline" onClick={() => { void loadFresh().then(() => { if (alive.current) { setAccessLost(false); setError(null) } }).catch((error) => { if (alive.current) setError(cloudError(error)) }) }}>Retry project</Button></div>
      : <BriefingPage key={generation} session={session} dispatch={dispatch} error={error} imageTransport={transport} presentation={presentation} />
  }
  return <>
    <AppHeader onHome={onHome} status={<><Badge variant="secondary">{session.mode === 'edit' ? 'Editor' : 'Read-only'}</Badge><span role="status" className="text-sm text-muted-foreground">{uploadStatus || status}</span></>} context={<BriefHeaderTitle
      name={session.brief.project.name}
      clientName={session.brief.project.clientName}
      mode={session.mode}
      onUpdate={(patch) => dispatch({ type: 'update', update: (brief) => ({ ...brief, project: { ...brief.project, ...patch } }) })}
    />}>
      {headerActions}
      <Button variant="outline" disabled={accessLost || uploading} onClick={() => setPdfOpen(true)}><FileDown /> Export</Button>
    </AppHeader>
    {accessLost ? <div className="grid gap-3 p-6"><Problem message={error ?? 'Project access is no longer available.'} /><Button variant="outline" onClick={() => { void loadFresh().then(() => { if (alive.current) { setAccessLost(false); setError(null) } }).catch((error) => { if (alive.current) setError(cloudError(error)) }) }}>Retry project</Button></div> : <BriefPage key={generation} session={session} dispatch={dispatch} error={error} imageTransport={transport} pdfMapRef={pdfMapRef} overlaySizeRef={overlaySizeRef}
      statusLeading={(status === 'Save failed' || status === 'Conflict') && <>
        {status === 'Save failed' && !accessLost && <Button size="sm" onClick={() => void coordinator.flush()}>Retry save</Button>}
        {(status === 'Conflict' || status === 'Save failed') && !accessLost && <><Button size="sm" variant="outline" onClick={() => setReloadConfirm(true)}>Reload latest</Button><Button size="sm" disabled={copying || uploading} onClick={() => void copyProject()}>{copying ? 'Copying…' : 'Save as a new project'}</Button></>}
      </>}
    />}
    {pdfOpen && !accessLost && <PdfExportDialog brief={session.brief} editable={session.mode === 'edit'} captureRef={pdfMapRef} link={exportLink} imageTransport={transport} overlaySizeRef={overlaySizeRef} onClose={() => setPdfOpen(false)}
      onSaveNotes={(notes) => dispatch({ type: 'update', update: (brief) => ({ ...brief, project: { ...brief.project, ...notes } }) })} />}
    <Dialog open={reloadConfirm} onOpenChange={setReloadConfirm}><DialogContent><DialogHeader><DialogTitle>Discard unsaved changes and reload?</DialogTitle><DialogDescription>Save a new project first if you need to keep these changes.</DialogDescription></DialogHeader><Button variant="destructive" onClick={() => { onDirty(false); onOpen(initial.summary.id) }}>Discard and reload latest</Button></DialogContent></Dialog>
  </>
}

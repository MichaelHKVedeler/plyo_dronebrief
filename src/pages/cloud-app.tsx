import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from '@/components/layout/app-header'
import { FileDown } from 'lucide-react'
import { BriefHeaderTitle } from '@/features/briefs/components/brief-header-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateBriefPage } from '@/pages/create-brief-page'
import { BriefPage } from '@/pages/brief-page'
import { PdfExportDialog } from '@/features/briefs/components/pdf-export-dialog'
import { parsePublicShareRoute, defaultBriefingPresentation, defaultOverlaySize } from '@/features/briefs/storage/public-brief-link'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { ProjectLibraryPage } from '@/pages/project-library-page'
import { OrganizationPage } from '@/pages/organization-page'
import { useAccount } from '@/features/cloud/auth/use-account'
import { cloudError, signInGoogle, signOutGoogle } from '@/features/cloud/auth/firebase'
import { Choice } from '@/features/cloud/components/choice'
import { Problem } from '@/features/cloud/components/problem'
import { CloudBrief } from '@/features/cloud/components/cloud-brief'
import { MigrateDialog } from '@/features/cloud/components/migrate-dialog'
import { cloudProjects, loadPublic } from '@/features/cloud/storage/project-repository'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { importBriefKey } from '@/features/briefs/storage/share-key'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'
import type { DroneBrief } from '@/features/briefs/model/brief'
import type { CloudProject } from '@/features/cloud/model/cloud'

const readRoute = () => location.hash.slice(1) || '/'
export function CloudApp() {
  const account = useAccount()
  const uid = account.user?.uid
  const [route, setRoute] = useState(readRoute); const routeRef = useRef(route)
  const [orgId, setOrgId] = useState(''); const organization = account.organizations.find((org) => org.id === orgId) ?? account.organizations[0]
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const [resource, setLoaded] = useState<{ identity: string; project: CloudProject } | null>(null); const [loadTick, setLoadTick] = useState(0)
  const [leave, setLeave] = useState<(() => void) | null>(null); const dirty = useRef(false)
  const [importOpen, setImportOpen] = useState(false); const [importKey, setImportKey] = useState('')
  const [snapshot, setSnapshot] = useState<ReturnType<typeof openSession> | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const pdfMapRef = useRef<PdfMapCapture | null>(null)
  const overlaySizeRef = useRef(defaultOverlaySize)
  const [migrate, setMigrate] = useState<DroneBrief | null>(null)
  const [{ drafts, draftError }] = useState(() => {
    try { return { drafts: briefRepository.list(), draftError: null } }
    catch { return { drafts: [] as DroneBrief[], draftError: 'Local drafts could not be read. Browser storage may be unavailable.' } }
  })
  const creationId = useRef(crypto.randomUUID())
  const publicShare = parsePublicShareRoute(route)
  const publicToken = publicShare?.token
  const projectId = route.startsWith('/projects/') ? route.slice(10) : undefined
  const identity = publicToken ? `public:${publicToken}` : `${uid ?? ''}:${projectId ?? ''}`
  const [resourceIdentity, setResourceIdentity] = useState(identity)
  if (resourceIdentity !== identity) { setResourceIdentity(identity); setLoaded(null); setError(null) }
  const loaded = resource?.identity === identity ? resource.project : null
  const goNow = useCallback((path: string) => { dirty.current = false; setLoaded(null); setSnapshot(null); setPdfOpen(false); setError(null); routeRef.current = path; history.pushState(null, '', `#${path}`); setRoute(path); setLoadTick((value) => value + 1) }, [])
  const guard = (action: () => void) => { if (dirty.current) setLeave(() => action); else action() }
  const openProject = useCallback((id: string) => goNow(`/projects/${id}`), [goNow])
  const onDirty = useCallback((value: boolean) => { dirty.current = value }, [])
  useEffect(() => {
    const changed = () => {
      const next = readRoute()
      if (next === routeRef.current) return
      if (dirty.current) { history.replaceState(null, '', `#${routeRef.current}`); setLeave(() => () => goNow(next)) }
      else { routeRef.current = next; setRoute(next); setLoaded(null); setSnapshot(null); setError(null) }
    }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed); window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); window.removeEventListener('beforeunload', beforeUnload) }
  }, [goNow])
  useEffect(() => {
    if (!publicToken && (!projectId || !uid)) return
    let active = true; const controller = new AbortController()
    void (publicToken ? loadPublic(publicToken, controller.signal) : cloudProjects.load(projectId!)).then((project) => { if (active) setLoaded({ identity, project }) }).catch((error) => { if (active) setError(cloudError(error)) })
    return () => { active = false; controller.abort() }
  }, [identity, projectId, publicToken, uid, loadTick])
  async function authenticate() { setBusy(true); setError(null); try { await signInGoogle() } catch (error) { setError(cloudError(error)) } finally { setBusy(false) } }
  async function create(brief: DroneBrief) {
    if (!organization || busy) return
    setBusy(true); setError(null)
    try { const project = await cloudProjects.create(organization.id, brief, creationId.current); creationId.current = crypto.randomUUID(); openProject(project.summary.id) }
    catch (error) { setError(cloudError(error)) } finally { setBusy(false) }
  }
  const briefScreen = Boolean(publicToken || projectId || snapshot)
  const projectOrganization = account.organizations.find((org) => org.id === loaded?.summary.orgId)
  const cloudBriefVisible = Boolean(loaded && (publicToken || (!snapshot && !account.loading && account.user && projectId)))
  const home = () => guard(() => goNow('/'))
  const headerActions = <>
      {account.user && !publicToken && <div className={briefScreen ? 'flex items-center gap-2' : 'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-3 sm:w-auto sm:grid-cols-[minmax(0,12rem)_minmax(9rem,12rem)_auto]'}>
        <div className={briefScreen ? 'min-w-0 text-sm' : 'col-span-2 grid min-w-0 gap-1 sm:col-span-1'}>
          {!briefScreen && <span className="text-xs font-medium text-muted-foreground">Signed in as</span>}
          <span className={briefScreen ? 'block truncate' : 'truncate text-sm font-medium sm:h-9 sm:leading-9'} title={account.user.displayName ?? account.user.email ?? undefined}>{account.user.displayName ?? account.user.email}</span>
        </div>
        {!briefScreen && organization && <div className="min-w-0"><Choice label="Organization" value={organization.id} onChange={(id) => { setOrgId(id); goNow('/') }} options={account.organizations.map((org) => ({ value: org.id, label: org.name }))} /></div>}
        <Button className="h-9 shrink-0" variant="outline" onClick={() => guard(() => { void signOutGoogle().catch((error) => setError(cloudError(error))) })}>Sign out</Button>
      </div>}
      {briefScreen && !publicToken && <Button variant="outline" onClick={home}>Home</Button>}
  </>
  return <div className={briefScreen ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : 'min-h-svh'}>
    {!cloudBriefVisible && !publicToken && <AppHeader onHome={home} status={snapshot && <Badge variant="secondary">Read-only</Badge>} context={snapshot && <BriefHeaderTitle name={snapshot.brief.project.name} clientName={snapshot.brief.project.clientName} mode="view" />}>
      {headerActions}
      {snapshot && <Button variant="outline" onClick={() => setPdfOpen(true)}><FileDown /> Export</Button>}
    </AppHeader>}
    {(error || account.error || draftError) && <div className="p-4"><Problem message={error ?? account.error ?? draftError} /><Button variant="outline" onClick={() => { setError(null); setLoaded(null); setLoadTick((value) => value + 1); if (account.user) void account.refresh() }}>Retry</Button></div>}
    {publicToken ? (loaded ? <CloudBrief key={`${publicToken}-${loadTick}`} initial={loaded} publicToken={publicToken} presentation={publicShare?.presentation ?? defaultBriefingPresentation} onDirty={onDirty} onOpen={openProject} onHome={home} /> : !error && <p role="status" className="p-6">Loading public project…</p>)
      : snapshot ? <><div className="flex flex-wrap gap-3 px-6 py-2"><span>Portable snapshot · read-only</span>{account.user && organization && <Button size="sm" onClick={() => setMigrate(snapshot.brief)}>Save as a cloud project</Button>}</div><BriefPage session={snapshot} dispatch={(action) => setSnapshot((previous) => previous ? reduceSession(previous, action) : null)} error={null} pdfMapRef={pdfMapRef} overlaySizeRef={overlaySizeRef} /></>
      : account.loading ? <p role="status" className="p-6">Loading account…</p>
      : !account.user ? <main className="mx-auto grid max-w-xl gap-5 px-6 py-16"><h1 className="text-3xl font-semibold">Dronebrief</h1><p>Sign in to create projects and collaborate with your organization.</p><Button disabled={busy} onClick={() => void authenticate()}>{busy ? 'Signing in…' : 'Sign in with Google'}</Button><Button variant="outline" onClick={() => setImportOpen(true)}>Open portable snapshot</Button></main>
      : projectId ? (loaded ? <CloudBrief key={`${account.user.uid}-${projectId}-${loadTick}`} initial={loaded} organization={projectOrganization} uid={account.user.uid} onDirty={onDirty} onOpen={openProject} onHome={home} headerActions={headerActions} /> : !error && <p role="status" className="p-6">Loading project…</p>)
      : !organization ? <main className="mx-auto grid max-w-xl gap-4 p-6"><h1 className="text-2xl font-semibold">Organization access required</h1><p>Ask an administrator to add your Google account email to an organization.</p><Button onClick={() => void account.refresh()}>Refresh access</Button><Button variant="outline" onClick={() => setImportOpen(true)}>Open portable snapshot</Button></main>
      : route === '/create' ? <>{busy && <p role="status" className="px-6">Creating your project…</p>}<CreateBriefPage onCreate={(brief) => void create(brief)} onCancel={() => goNow('/')} /></>
      : route === '/library' ? <ProjectLibraryPage key={organization.id} organization={organization} uid={account.user.uid} onOpen={openProject} />
      : route === '/organization' && organization.role === 'admin' ? <OrganizationPage key={organization.id} organization={organization} onChange={account.refresh} />
      : route === '/' ? <main className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-12"><h1 className="text-3xl font-semibold">Plan your next shoot.</h1><div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle>Create project</CardTitle></CardHeader><CardContent><Button onClick={() => goNow('/create')}>Create project</Button></CardContent></Card><Card><CardHeader><CardTitle>Load projects</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={() => goNow('/library')}>Load projects</Button></CardContent></Card></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}>Import portable snapshot</Button><Button variant="outline" onClick={() => void account.refresh()}>Refresh access</Button>{organization.role === 'admin' && <Button variant="outline" onClick={() => goNow('/organization')}>Manage organization</Button>}</div>{drafts.length > 0 && <section className="grid gap-3"><h2 className="text-lg font-medium">Local drafts on this device</h2>{drafts.map((draft) => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span>{draft.project.name}</span><Button variant="outline" onClick={() => setMigrate(draft)}>Save to organization</Button></div>)}</section>}</main>
      : <main className="p-6"><Problem message="This page is unavailable, or you do not have permission to open it." /></main>}
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent><DialogHeader><DialogTitle>Open portable snapshot</DialogTitle><DialogDescription>A snapshot is a frozen copy. Local floorplan references may need reconnecting.</DialogDescription></DialogHeader><Problem message={error} /><Label htmlFor="snapshot-key">Export key</Label><Textarea id="snapshot-key" value={importKey} onChange={(event) => setImportKey(event.target.value)} /><Button onClick={() => { try { setSnapshot(openSession(importBriefKey(importKey), 'view')); setImportOpen(false); setError(null) } catch (error) { setError(cloudError(error)) } }}>Open read-only brief</Button></DialogContent></Dialog>
    {migrate && account.user && <MigrateDialog brief={migrate} organizations={account.organizations} uid={account.user.uid} onDirty={onDirty} onClose={() => setMigrate(null)} onSaved={(id) => { setMigrate(null); openProject(id) }} />}
    {snapshot && pdfOpen && <PdfExportDialog brief={snapshot.brief} editable={false} captureRef={pdfMapRef} overlaySizeRef={overlaySizeRef} link={{ status: 'unavailable', reason: 'snapshot' }} onSaveNotes={() => {}} onClose={() => setPdfOpen(false)} />}
    <Dialog open={Boolean(leave)} onOpenChange={(open) => { if (!open) setLeave(null) }}><DialogContent><DialogHeader><DialogTitle>Leave with unsaved changes?</DialogTitle><DialogDescription>Keep this page open to save or export your work. Leaving discards unsaved changes and cancels uploads.</DialogDescription></DialogHeader><Button variant="outline" onClick={() => setLeave(null)}>Keep editing</Button><Button variant="destructive" onClick={() => { const action = leave; setLeave(null); dirty.current = false; action?.() }}>Discard and leave</Button></DialogContent></Dialog>
  </div>
}

import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, Share2, FileDown } from 'lucide-react'
import { PdfExportDialog } from '@/features/briefs/components/pdf-export-dialog'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { AppHeader } from '@/components/layout/app-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LandingPage } from '@/pages/landing-page'
import { CreateBriefPage } from '@/pages/create-brief-page'
import { BriefPage } from '@/pages/brief-page'
import { ExportDialog } from '@/features/briefs/components/export-dialog'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { exportBriefKey } from '@/features/briefs/storage/share-key'
import { openSession, reduceSession, type BriefAction, type BriefSession } from '@/features/briefs/state/brief-session'
import type { DroneBrief } from '@/features/briefs/model/brief'
import { cloudConfigured } from '@/features/cloud/auth/config'
const CloudApp = lazy(() => import('@/pages/cloud-app').then((module) => ({ default: module.CloudApp })))

type Screen = { page: 'landing' } | { page: 'create' } | { page: 'brief'; session: BriefSession }
export default function App() {
  if (!cloudConfigured && /^#\/(projects|s)\//.test(location.hash)) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-semibold">Cloud projects are not configured</h1><p className="mt-4" role="alert">This installation needs Firebase configuration to open project links. Follow docs/firebase-setup.md.</p></main>
  return cloudConfigured ? <Suspense fallback={<p role="status" className="p-6">Loading account…</p>}><CloudApp /></Suspense> : <LocalApp />
}
function LocalApp() {
  const [screen, setScreen] = useState<Screen>({ page: 'landing' })
  const currentScreen = useRef(screen)
  useLayoutEffect(() => { currentScreen.current = screen }, [screen])
  const [draft, setDraft] = useState<DroneBrief | null>(() => {
    try { return briefRepository.latest() } catch { return null }
  })
  const [error, setError] = useState<string | null>(() => {
    try { briefRepository.latest(); return null } catch { return 'The saved draft could not be read. Browser storage may be unavailable, or the saved data is invalid.' }
  })
  const [saveStatus, setSaveStatus] = useState('Saving…')
  const [shareKey, setShareKey] = useState<string | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const pdfMapRef = useRef<PdfMapCapture | null>(null)
  function saveBrief(brief: DroneBrief) {
    try {
      briefRepository.save(brief)
      setDraft(brief)
      setSaveStatus('Saved on this device')
      setError(null)
    } catch {
      setSaveStatus('Not saved')
      setError('Changes could not be saved on this device. Keep this page open and export a key to keep your work.')
    }
  }

  function home() { setScreen({ page: 'landing' }); setShareKey(null); setPdfOpen(false) }
  function openBrief(brief: DroneBrief, mode: 'edit' | 'view') {
    setError(null); setScreen({ page: 'brief', session: openSession(brief, mode) })
    if (mode === 'edit') saveBrief(brief)
  }
  function dispatch(action: BriefAction) {
    // Upload completion may add an image and reveal its layer in the same turn.
    // Reduce each action against the latest result, including async file reads.
    const current = currentScreen.current
    if (current.page !== 'brief' || screen.page !== 'brief' || current.session.brief.id !== screen.session.brief.id) return
    const session = reduceSession(current.session, action)
    const next: Screen = { page: 'brief', session }
    currentScreen.current = next
    setScreen(next)
    if (session.brief !== current.session.brief && session.mode === 'edit') saveBrief(session.brief)
  }
  return <div className={screen.page === 'brief' ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : 'min-h-svh'}>
    <AppHeader onHome={home} context={screen.page === 'brief' && <div className="flex min-w-0 items-center gap-2">
      <h1 className="min-w-0 truncate text-base font-semibold tracking-tight" title={screen.session.brief.project.name}>{screen.session.brief.project.name}</h1>
      <Badge variant="secondary" className="shrink-0">{screen.session.mode === 'edit' ? 'Editor' : 'Read-only'}</Badge>
    </div>}>{screen.page === 'brief' && <>
      <span role="status" className="mr-2 text-sm text-muted-foreground">{screen.session.mode === 'edit' ? saveStatus : 'Viewing shared snapshot'}</span>
      <Button variant="outline" onClick={home}><ArrowLeft /> Home</Button>
      <Button variant="outline" onClick={() => setPdfOpen(true)}><FileDown /> Export as PDF</Button>
      {screen.session.mode === 'edit' && <Button onClick={() => {
        try { setShareKey(exportBriefKey(screen.session.brief)) } catch (error) { setError((error as Error).message) }
      }}><Share2 /> Export</Button>}
    </>}</AppHeader>
    {screen.page === 'landing' && <LandingPage onCreate={() => { setError(null); setScreen({ page: 'create' }) }} onLoad={(brief) => openBrief(brief, 'view')} draft={draft} onResume={() => { if (draft) openBrief(draft, 'edit') }} error={error} />}
    {screen.page === 'create' && <CreateBriefPage onCreate={(brief) => openBrief(brief, 'edit')} onCancel={home} />}
    {screen.page === 'brief' && <BriefPage pdfMapRef={pdfMapRef} session={screen.session} dispatch={dispatch} error={error} />}
    {screen.page === 'brief' && pdfOpen && <PdfExportDialog brief={screen.session.brief} editable={screen.session.mode === 'edit'} captureRef={pdfMapRef} onClose={() => setPdfOpen(false)}
      onSaveNotes={(notes) => dispatch({ type: 'update', update: (brief) => ({ ...brief, project: { ...brief.project, ...notes } }) })} />}
    <ExportDialog shareKey={shareKey} hasLocalImages={screen.page === 'brief' && screen.session.brief.imageOverlays.some((image) => typeof image.source !== 'string')} onClose={() => setShareKey(null)} />
  </div>
}

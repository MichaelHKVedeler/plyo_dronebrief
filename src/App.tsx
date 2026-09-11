import { useState } from 'react'
import { ArrowLeft, Share2 } from 'lucide-react'
import { AppHeader } from '@/components/layout/app-header'
import { Button } from '@/components/ui/button'
import { LandingPage } from '@/pages/landing-page'
import { CreateBriefPage } from '@/pages/create-brief-page'
import { BriefPage } from '@/pages/brief-page'
import { ExportDialog } from '@/features/briefs/components/export-dialog'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { exportBriefKey } from '@/features/briefs/storage/share-key'
import { openSession, reduceSession, type BriefAction, type BriefSession } from '@/features/briefs/state/brief-session'
import type { DroneBrief } from '@/features/briefs/model/brief'

type Screen = { page: 'landing' } | { page: 'create' } | { page: 'brief'; session: BriefSession }
export default function App() {
  const [screen, setScreen] = useState<Screen>({ page: 'landing' })
  const [draft, setDraft] = useState<DroneBrief | null>(() => {
    try { return briefRepository.latest() } catch { return null }
  })
  const [error, setError] = useState<string | null>(() => {
    try { briefRepository.latest(); return null } catch { return 'The saved draft could not be read. Browser storage may be unavailable, or the saved data is invalid.' }
  })
  const [saveStatus, setSaveStatus] = useState('Saving…')
  const [shareKey, setShareKey] = useState<string | null>(null)
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

  function home() { setScreen({ page: 'landing' }); setShareKey(null) }
  function openBrief(brief: DroneBrief, mode: 'edit' | 'view') {
    setError(null); setScreen({ page: 'brief', session: openSession(brief, mode) })
    if (mode === 'edit') saveBrief(brief)
  }
  function dispatch(action: BriefAction) {
    if (screen.page !== 'brief') return
    const session = reduceSession(screen.session, action)
    setScreen({ page: 'brief', session })
    if (session.brief !== screen.session.brief && session.mode === 'edit') saveBrief(session.brief)
  }
  return <div className={screen.page === 'brief' ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : 'min-h-svh'}>
    <AppHeader onHome={home}>{screen.page === 'brief' && <>
      <span role="status" className="mr-2 text-sm text-muted-foreground">{screen.session.mode === 'edit' ? saveStatus : 'Viewing shared snapshot'}</span>
      <Button variant="outline" onClick={home}><ArrowLeft /> Home</Button>
      {screen.session.mode === 'edit' && <Button onClick={() => {
        try { setShareKey(exportBriefKey(screen.session.brief)) } catch (error) { setError((error as Error).message) }
      }}><Share2 /> Export</Button>}
    </>}</AppHeader>
    {screen.page === 'landing' && <LandingPage onCreate={() => { setError(null); setScreen({ page: 'create' }) }} onLoad={(brief) => openBrief(brief, 'view')} draft={draft} onResume={() => { if (draft) openBrief(draft, 'edit') }} error={error} />}
    {screen.page === 'create' && <CreateBriefPage onCreate={(brief) => openBrief(brief, 'edit')} onCancel={home} />}
    {screen.page === 'brief' && <BriefPage session={screen.session} dispatch={dispatch} error={error} />}
    <ExportDialog shareKey={shareKey} onClose={() => setShareKey(null)} />
  </div>
}

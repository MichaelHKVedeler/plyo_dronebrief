import { idleTool } from '@/features/map/placement'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppHeader } from '@/components/layout/app-header'
import { MapPanel } from '@/features/map/map-panel'
import { ShootTimes } from '@/features/briefs/components/shoot-times'
import { CaptureInstructionsList } from '@/features/briefs/components/capture-instructions-list'
import { briefingCopy } from '@/features/briefs/components/briefing-copy'
import { useLocalImages } from '@/features/briefs/state/use-local-images'
import { pdfProjectSize } from '@/features/briefs/export/pdf-project'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'
import type { ImageTransport } from '@/features/briefs/storage/image-transport'
import type { BriefingPresentation } from '@/features/briefs/storage/public-brief-link'
import type { IsolatedCapture } from '@/features/map/isolated-capture'

export function BriefingPage({ session, dispatch, error, imageTransport, presentation }: {
  session: BriefSession
  dispatch: (action: BriefAction) => void
  error: string | null
  imageTransport?: ImageTransport
  presentation: BriefingPresentation
}) {
  const images = useLocalImages(session.brief.imageOverlays, imageTransport)
  const referenceImages = useLocalImages(session.brief.references, imageTransport)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([])
  const [isolatedKind, setIsolatedKind] = useState<IsolatedCapture>(null)
  const copy = briefingCopy[presentation.language]
  function select(id: string | null) {
    setSelectedId(id)
    setSelectedCameraIds(id && session.brief.angles.some((angle) => angle.id === id) ? [id] : [])
  }
  function selectCamera(id: string, additive: boolean) {
    if (!additive) { select(id); return }
    setSelectedId(id)
    setSelectedCameraIds((ids) => ids.includes(id) ? ids : [...ids, id])
  }
  const title = [
    presentation.includeProjectName ? session.brief.project.name : '',
    presentation.includeClientName ? session.brief.project.clientName : '',
  ].filter(Boolean)
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <AppHeader align="map" context={(presentation.address || title.length > 0) && <div className="flex min-w-0 max-w-full items-baseline justify-center gap-8 text-center">
      {title.length > 0 && <div className="flex min-w-0 items-baseline gap-2">
        {presentation.includeProjectName && <h1 className="min-w-0 truncate text-base leading-5 font-semibold tracking-tight" title={session.brief.project.name}>{session.brief.project.name}</h1>}
        {presentation.includeClientName && <p className="min-w-0 truncate text-sm leading-5 text-muted-foreground" title={session.brief.project.clientName}>{session.brief.project.clientName}</p>}
      </div>}
      {presentation.address ? <p className="min-w-0 truncate text-sm leading-5 font-semibold" title={presentation.address}>{presentation.address}</p> : null}
    </div>} />
    <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-visible">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:px-4">
        {error && <Alert variant="destructive" className="mb-4 max-h-28 shrink-0 overflow-y-auto"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(480px,1fr)_minmax(360px,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]">
          <MapPanel presentation="briefing" objectSizePercent={presentation.overlaySize} images={images} selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} session={session} dispatch={dispatch} tool={idleTool} onToolChange={() => {}} selectedId={selectedId} onSelect={select} isolatedKind={isolatedKind} />
          <aside className="min-h-0 min-w-0" aria-label="Brief details">
            <Card className="h-full min-h-0 overflow-hidden py-0"><CardContent className="flex min-h-0 flex-1 flex-col px-0">
              <ScrollArea type="always" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
                <div className="grid gap-6 px-4 py-4">
                  <div className="grid gap-1">
                    <ShootTimes brief={session.brief} labels={{ shootTimes: copy.shootTimes, totalImages: copy.totalImages }} />
                    <p className="font-semibold">{copy.projectSizes[pdfProjectSize(session.brief)]}</p>
                    <p className="text-xs text-muted-foreground">{copy.projectSizeNote}</p>
                  </div>
                  <section className="grid gap-3" aria-label={copy.property}>
                    <div>
                      <p className="text-sm font-medium">{copy.property}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{session.brief.project.description || copy.emptyProperty}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{copy.instructions}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{session.brief.project.instructions || copy.emptyInstructions}</p>
                    </div>
                  </section>
                  <CaptureInstructionsList brief={session.brief} language={presentation.language} isolatedKind={isolatedKind} onIsolate={setIsolatedKind} />
                  {session.brief.references.length > 0 && <section className="grid gap-3" aria-label={copy.references}>
                    <p className="text-sm font-medium">{copy.references}</p>
                    {session.brief.references.map((reference) => {
                      const url = referenceImages.sourceUrl(reference)
                      const message = typeof reference.source === 'string' ? undefined : referenceImages.resources[reference.source.fileId]?.message
                      return <figure key={reference.id} className="grid gap-2">
                        {url ? <img src={url} alt={reference.caption} className="max-h-56 w-full rounded-md bg-white object-contain" />
                          : <p className="text-sm text-muted-foreground">{message ?? 'Loading reference image…'}</p>}
                        <figcaption className="text-sm text-muted-foreground">{reference.caption}</figcaption>
                      </figure>
                    })}
                  </section>}
                </div>
              </ScrollArea>
            </CardContent></Card>
          </aside>
        </div>
      </div>
    </main>
  </div>
}

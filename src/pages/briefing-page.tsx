import { idleTool } from '@/features/map/placement'
import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MapPanel } from '@/features/map/map-panel'
import { briefingCopy } from '@/features/briefs/components/briefing-copy'
import { briefingContentBrief } from '@/features/briefs/components/briefing-content'
import { BriefingDetails } from '@/features/briefs/components/briefing-details'
import { useBriefingAddress } from '@/features/briefs/components/use-pdf-address'
import { pdfProjectPosition } from '@/features/briefs/export/pdf-project'
import { BriefingMapLayers } from '@/features/briefs/components/briefing-map-layers'
import { PointHeightsCallout } from '@/features/briefs/components/point-heights-callout'
import { useLocalImages } from '@/features/briefs/state/use-local-images'
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
  const scanOnly = presentation.content === 'scan'
  const brief = useMemo(() => briefingContentBrief(session.brief, presentation.content), [session.brief, presentation.content])
  const shown = useMemo(() => ({ ...session, brief }), [session, brief])
  const address = useBriefingAddress(pdfProjectPosition(session.brief), presentation.address)
  const images = useLocalImages(session.brief.imageOverlays, imageTransport)
  const referenceImages = useLocalImages(session.brief.references, imageTransport)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([])
  const [chosenKind, setChosenKind] = useState<IsolatedCapture>(null)
  // Briefings hide the scan group until it is isolated, so a drone scan link shows it by default
  // and its two buttons isolate the circles or the extra coverage points.
  const isolatedKind: IsolatedCapture = !scanOnly ? chosenKind
    : chosenKind === 'droneScan' ? 'scanCircles' : chosenKind === 'extra-coverage' ? 'extra-coverage' : 'droneScan'
  const [infoOpen, setInfoOpen] = useState(false)
  const copy = briefingCopy[presentation.language]
  function select(id: string | null) {
    setSelectedId(id)
    setSelectedCameraIds(id && brief.angles.some((angle) => angle.id === id) ? [id] : [])
  }
  function selectCamera(id: string, additive: boolean) {
    if (!additive && selectedId === id) { select(null); return }
    if (!additive) { select(id); return }
    setSelectedId(id)
    setSelectedCameraIds((ids) => ids.includes(id) ? ids : [...ids, id])
  }
  return <div className="relative flex min-h-0 w-full min-w-0 flex-1 overflow-hidden overscroll-none">
    <div className="relative min-h-0 min-w-0 flex-1">
      <MapPanel presentation="briefing" objectSizePercent={presentation.overlaySize} images={images} selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} session={shown} dispatch={dispatch} tool={idleTool} onToolChange={() => {}} selectedId={selectedId} onSelect={select} isolatedKind={isolatedKind}
        pointCallout={selectedId && brief.angles.some((angle) => angle.id === selectedId && angle.type !== 'extra-coverage') ? <PointHeightsCallout brief={brief} angleId={selectedId} language={presentation.language} onClose={() => select(null)} /> : null}
        layerControls={<BriefingMapLayers brief={brief} language={presentation.language} isolatedKind={chosenKind} onIsolate={setChosenKind} scanSplit={scanOnly}
          floorplanVisible={session.visibility.imageOverlays}
          onFloorplanVisible={(visible) => dispatch({ type: 'visibility', layer: 'imageOverlays', visible })} />} />
      {!infoOpen && <Button type="button" variant="ghost" size="icon" className="pointer-events-auto absolute bottom-8 left-3 z-20 border bg-card shadow-sm lg:hidden" aria-label={copy.info} aria-expanded={false} aria-controls="briefing-details" onClick={() => setInfoOpen(true)}>
        <Info />
      </Button>}
      {error && <Alert variant="destructive" className="pointer-events-auto absolute inset-x-3 top-3 z-50 max-h-28 overflow-y-auto sm:left-auto sm:max-w-sm"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
    <aside id="briefing-details" aria-label="Brief details" className={infoOpen
      ? 'absolute inset-0 z-40 flex min-h-0 min-w-0 lg:static lg:inset-auto lg:z-auto lg:w-[360px] lg:shrink-0'
      : 'hidden lg:flex lg:w-[360px] lg:shrink-0'}>
      <BriefingDetails session={shown} presentation={{ ...presentation, address }} copy={copy} isolatedKind={isolatedKind} referenceImages={referenceImages} onClose={() => setInfoOpen(false)} />
    </aside>
  </div>
}

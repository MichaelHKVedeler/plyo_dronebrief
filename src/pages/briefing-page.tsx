import { idleTool } from '@/features/map/placement'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MapPanel } from '@/features/map/map-panel'
import { briefingCopy } from '@/features/briefs/components/briefing-copy'
import { BriefingDetails } from '@/features/briefs/components/briefing-details'
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
  const images = useLocalImages(session.brief.imageOverlays, imageTransport)
  const referenceImages = useLocalImages(session.brief.references, imageTransport)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([])
  const [isolatedKind, setIsolatedKind] = useState<IsolatedCapture>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const copy = briefingCopy[presentation.language]
  function select(id: string | null) {
    setSelectedId(id)
    setSelectedCameraIds(id && session.brief.angles.some((angle) => angle.id === id) ? [id] : [])
  }
  function selectCamera(id: string, additive: boolean) {
    if (!additive && selectedId === id) { select(null); return }
    if (!additive) { select(id); return }
    setSelectedId(id)
    setSelectedCameraIds((ids) => ids.includes(id) ? ids : [...ids, id])
  }
  return <div className="relative flex min-h-0 w-full min-w-0 flex-1 overflow-hidden overscroll-none">
    <div className="relative min-h-0 min-w-0 flex-1">
      <MapPanel presentation="briefing" objectSizePercent={presentation.overlaySize} images={images} selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} session={session} dispatch={dispatch} tool={idleTool} onToolChange={() => {}} selectedId={selectedId} onSelect={select} isolatedKind={isolatedKind}
        pointCallout={selectedId ? <PointHeightsCallout brief={session.brief} angleId={selectedId} language={presentation.language} onClose={() => select(null)} /> : null}
        layerControls={<BriefingMapLayers brief={session.brief} language={presentation.language} isolatedKind={isolatedKind} onIsolate={setIsolatedKind}
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
      <BriefingDetails session={session} presentation={presentation} copy={copy} isolatedKind={isolatedKind} referenceImages={referenceImages} onClose={() => setInfoOpen(false)} />
    </aside>
  </div>
}

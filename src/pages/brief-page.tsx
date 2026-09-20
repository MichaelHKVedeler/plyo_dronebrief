import { defaultRigArrowCount, type Position } from '@/features/briefs/model/brief'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPanel } from '@/features/map/map-panel'
import { ProjectPanel } from '@/features/briefs/components/project-panel'
import { LayersPanel } from '@/features/briefs/components/layers-panel'
import { ShootTimes } from '@/features/briefs/components/shoot-times'
import { idleTool, startCameraPlacement, type MapTool, type CameraType } from '@/features/map/placement'
import { useLocalImages } from '@/features/briefs/state/use-local-images'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'
import type { ImageTransport } from '@/features/briefs/storage/image-transport'

export function BriefPage({ session, dispatch, error, pdfMapRef, imageTransport, overlaySizeRef, statusLeading, statusTrailing }: { session: BriefSession; dispatch: (action: BriefAction) => void; error: string | null; pdfMapRef?: RefObject<PdfMapCapture | null>; imageTransport?: ImageTransport; overlaySizeRef?: RefObject<number>; statusLeading?: ReactNode; statusTrailing?: ReactNode }) {
  const images = useLocalImages(session.brief.imageOverlays, imageTransport)
  const referenceImages = useLocalImages(session.brief.references, imageTransport)
  const [focusPosition, setFocusPosition] = useState<Position | null>(null)
  const pendingRig = useRef<string | null>(null)
  const viewCenter = useRef(session.brief.coordinates)
  const rigPlacement = useRef<(() => { position: Position; radiusMeters: number }) | null>(null)
  function addRig() {
    if (session.mode !== 'edit') return
    const placement = rigPlacement.current?.() ?? { position: { ...viewCenter.current }, radiusMeters: 50 }
    const rig = { id: crypto.randomUUID(), ...placement, arrowCount: defaultRigArrowCount, ovalRatio: 1, rotationDegrees: 0 }
    pendingRig.current = rig.id
    dispatch({ type: 'update', update: (brief) => brief.circleRig ? brief : { ...brief, circleRig: rig } })
    setTool(idleTool)
    select(rig.id)
  }
  useEffect(() => {
    if (pendingRig.current && session.brief.circleRig?.id === pendingRig.current) {
      pendingRig.current = null
      if (!session.visibility.circleRig) dispatch({ type: 'visibility', layer: 'circleRig', visible: true })
    }
  }, [dispatch, session.brief.circleRig, session.visibility.circleRig])
  const [tool, setTool] = useState<MapTool>(idleTool)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([])
  function select(id: string | null) {
    setSelectedId(id)
    setSelectedCameraIds(id && session.brief.angles.some((a) => a.id === id) ? [id] : [])
  }
  function selectCamera(id: string, additive: boolean) {
    if (!additive) { select(id); return }
    setSelectedId(id)
    setSelectedCameraIds((ids) => ids.includes(id) ? ids : [...ids, id])
  }
  function removeCameras(ids: string[]) {
    if (session.mode !== 'edit') return
    dispatch({ type: 'update', update: (brief) => ({ ...brief, angles: brief.angles.filter((angle) => !ids.includes(angle.id)) }) })
    setSelectedCameraIds((selected) => selected.filter((id) => !ids.includes(id)))
    if (selectedId && ids.includes(selectedId)) setSelectedId(null)
  }
  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key === 'Escape') { setTool(idleTool); setSelectedId(null); setSelectedCameraIds([]) }
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])
  useEffect(() => {
    function removeSelected(event: KeyboardEvent) {
      if (event.key !== 'Delete' || event.repeat || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
      if (session.mode !== 'edit' || tool.kind !== 'idle' || !session.brief.angles.some((angle) => selectedCameraIds.includes(angle.id))) return
      if (event.composedPath().some((target) => target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"], [role="dialog"], [role="alertdialog"]')))) return
      event.preventDefault()
      dispatch({ type: 'update', update: (brief) => ({ ...brief, angles: brief.angles.filter((angle) => !selectedCameraIds.includes(angle.id)) }) })
      setSelectedId(null); setSelectedCameraIds([])
    }
    window.addEventListener('keydown', removeSelected)
    return () => window.removeEventListener('keydown', removeSelected)
  }, [dispatch, selectedCameraIds, session, tool.kind])
  function addCamera(type: CameraType) {
    if (session.mode !== 'edit') return
    dispatch({ type: 'visibility', layer: 'angles', visible: true })
    setSelectedId(null)
    setSelectedCameraIds([])
    setTool(startCameraPlacement(type))
  }
  return <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-visible">
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm">
      {statusLeading}
      <ShootTimes brief={session.brief} />
      {statusTrailing && <div className="ml-auto flex flex-wrap items-center gap-3">{statusTrailing}</div>}
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:px-4">
    {error && <Alert variant="destructive" className="mb-4 max-h-28 shrink-0 overflow-y-auto"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(480px,1fr)_minmax(360px,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]">
      <MapPanel pdfMapRef={pdfMapRef} images={images} rigPlacementRef={rigPlacement} overlaySizeRef={overlaySizeRef} focusPosition={focusPosition} onViewCenterChange={(center) => { viewCenter.current = center }} selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} session={session} dispatch={dispatch} tool={tool} onToolChange={setTool} selectedId={selectedId} onSelect={select} />
      <aside className="min-h-0 min-w-0" aria-label="Brief details">
        <Card className="h-full min-h-0 overflow-hidden py-0"><CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <Tabs defaultValue="project" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 my-4 w-auto shrink-0"><TabsTrigger value="project">Project</TabsTrigger><TabsTrigger value="contents">Contents</TabsTrigger></TabsList>
            <ScrollArea type="always" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
              <div className="px-4 pb-4">
                <TabsContent value="project"><ProjectPanel onCenterCamera={(angle) => setFocusPosition({ ...angle.position })} onAddRig={addRig} selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} onRemoveCameras={removeCameras} session={session} selectedId={selectedId} onSelect={select} onAddCamera={addCamera} onUpdate={(update) => dispatch({ type: 'update', update })} /></TabsContent>
                <TabsContent value="contents"><LayersPanel session={session} images={images} referenceImages={referenceImages} selectedId={selectedId} onSelect={(id) => { select(id); setTool(idleTool) }}
                  placement={() => rigPlacement.current?.() ?? { position: viewCenter.current, radiusMeters: 50 }}
                  onUpdate={(update) => dispatch({ type: 'update', update })}
                  onShow={() => dispatch({ type: 'visibility', layer: 'imageOverlays', visible: true })} /></TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent></Card>
      </aside>
    </div>
    </div>
  </main>
}

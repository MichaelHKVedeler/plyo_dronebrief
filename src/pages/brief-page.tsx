import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from '@/features/briefs/components/settings-section'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPanel } from '@/features/map/map-panel'
import { ProjectPanel } from '@/features/briefs/components/project-panel'
import { LayersPanel } from '@/features/briefs/components/layers-panel'
import { idleTool, startCameraPlacement, type MapTool, type CameraType } from '@/features/map/placement'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'

export function BriefPage({ session, dispatch, error }: { session: BriefSession; dispatch: (action: BriefAction) => void; error: string | null }) {
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
  return <main className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col px-4 py-4 sm:px-6">
    <div className="mb-4 flex shrink-0 items-center gap-3"><h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl" title={session.brief.project.name}>{session.brief.project.name}</h1><Badge variant="secondary">{session.mode === 'edit' ? 'Editor' : 'Read-only'}</Badge></div>
    {error && <Alert variant="destructive" className="mb-4 max-h-28 shrink-0 overflow-y-auto"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]">
      <MapPanel selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} session={session} dispatch={dispatch} tool={tool} onToolChange={setTool} selectedId={selectedId} onSelect={select} />
      <aside className="min-h-0 min-w-0" aria-label="Brief details">
        <Card className="h-full min-h-0 overflow-hidden py-0"><CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <Tabs defaultValue="project" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 my-4 w-auto shrink-0"><TabsTrigger value="project">Project</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger></TabsList>
            <ScrollArea type="always" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
              <div className="px-4 pb-4">
                <TabsContent value="project"><ProjectPanel selectedCameraIds={selectedCameraIds} onSelectCamera={selectCamera} onRemoveCameras={removeCameras} session={session} selectedId={selectedId} onSelect={select} onAddCamera={addCamera} placing={tool.kind !== 'idle'} onUpdate={(update) => dispatch({ type: 'update', update })} /></TabsContent>
                <TabsContent value="layers"><LayersPanel session={session} onToggle={(layer, visible) => dispatch({ type: 'visibility', layer, visible })} /></TabsContent>
                <Accordion type="multiple" className="mt-2"><SettingsSection value="help" title="Map help"><p className="text-sm text-muted-foreground">{session.mode === 'edit' ? 'Drag objects to move them. Drag the rig edge dot to scale and rotate. The inside oval handle adjusts ovalness. Camera arrows adjust the look-at direction.' : 'Camera icons show the type, and direction lines show where each camera points.'}</p><p className="text-sm text-muted-foreground">Search to jump to a location. Frame scene brings all cameras and the rig back into view.</p></SettingsSection></Accordion>
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent></Card>
      </aside>
    </div>
  </main>
}

import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPanel } from '@/features/map/map-panel'
import { ProjectPanel } from '@/features/briefs/components/project-panel'
import { LayersPanel } from '@/features/briefs/components/layers-panel'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'

export function BriefPage({ session, dispatch, error }: { session: BriefSession; dispatch: (action: BriefAction) => void; error: string | null }) {
  return <main className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col px-4 py-4 sm:px-6">
    <div className="mb-4 flex shrink-0 items-center gap-3"><h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl" title={session.brief.project.name}>{session.brief.project.name}</h1><Badge variant="secondary">{session.mode === 'edit' ? 'Editor' : 'Read-only'}</Badge></div>
    {error && <Alert variant="destructive" className="mb-4 max-h-28 shrink-0 overflow-y-auto"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]">
      <MapPanel session={session} onPosition={(coordinates) => dispatch({ type: 'update', update: (brief) => ({ ...brief, coordinates }) })} />
      <aside className="min-h-0 min-w-0" aria-label="Brief details">
        <Card className="h-full min-h-0 overflow-hidden py-0"><CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <Tabs defaultValue="project" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 my-4 w-auto shrink-0"><TabsTrigger value="project">Project</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger></TabsList>
            <ScrollArea type="always" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
              <div className="px-4 pb-4">
                <TabsContent value="project"><ProjectPanel session={session} onUpdate={(update) => dispatch({ type: 'update', update })} /></TabsContent>
                <TabsContent value="layers"><LayersPanel session={session} onToggle={(layer, visible) => dispatch({ type: 'visibility', layer, visible })} /></TabsContent>
                <p className="mt-5 text-sm text-muted-foreground">Map tools for angle placement, image alignment, and polygon drawing are planned for the next development stage.</p>
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent></Card>
      </aside>
    </div>
  </main>
}

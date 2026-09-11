import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MapPanel } from '@/features/map/map-panel'
import { ProjectPanel } from '@/features/briefs/components/project-panel'
import { LayersPanel } from '@/features/briefs/components/layers-panel'
import type { BriefAction, BriefSession } from '@/features/briefs/state/brief-session'

export function BriefPage({ session, dispatch, error }: { session: BriefSession; dispatch: (action: BriefAction) => void; error: string | null }) {
  return <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
    <div className="mb-5 flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{session.brief.project.name}</h1><Badge variant="secondary">{session.mode === 'edit' ? 'Editor' : 'Read-only'}</Badge></div>
    {error && <Alert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-3"><MapPanel session={session} onPosition={(coordinates) => dispatch({ type: 'update', update: (brief) => ({ ...brief, coordinates }) })} /><p className="text-sm text-muted-foreground">Map tools for angle placement, image alignment, and polygon drawing are planned for the next development stage.</p></div>
      <Card><CardContent>
        <Tabs defaultValue="project"><TabsList className="mb-5 w-full"><TabsTrigger value="project">Project</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger></TabsList>
          <TabsContent value="project"><ProjectPanel session={session} onUpdate={(update) => dispatch({ type: 'update', update })} /></TabsContent>
          <TabsContent value="layers"><LayersPanel session={session} onToggle={(layer, visible) => dispatch({ type: 'visibility', layer, visible })} /></TabsContent>
        </Tabs>
      </CardContent></Card>
    </div>
  </main>
}

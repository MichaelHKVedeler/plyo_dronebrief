import { X } from 'lucide-react'
import { AppBrand } from '@/components/layout/app-header'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { pdfProjectSize } from '@/features/briefs/export/pdf-project'
import type { BriefSession } from '@/features/briefs/state/brief-session'
import type { LocalImages } from '@/features/briefs/state/use-local-images'
import type { IsolatedCapture } from '@/features/map/isolated-capture'
import type { BriefingPresentation } from '@/features/briefs/storage/public-brief-link'
import type { BriefingCopy } from './briefing-copy'
import { CaptureInstructionsList } from './capture-instructions-list'
import { ShootTimes } from './shoot-times'

export function BriefingDetails({ session, presentation, copy, isolatedKind, referenceImages, onClose }: {
  session: BriefSession
  presentation: BriefingPresentation
  copy: BriefingCopy
  isolatedKind: IsolatedCapture
  referenceImages: LocalImages
  onClose: () => void
}) {
  const title = [
    presentation.includeProjectName ? session.brief.project.name : '',
    presentation.includeClientName ? session.brief.project.clientName : '',
  ].filter(Boolean)
  return <Card className="h-full min-h-0 w-full overflow-hidden bg-card/80 py-0 backdrop-blur-md lg:bg-card lg:backdrop-blur-none">
    <CardContent className="flex min-h-0 flex-1 flex-col px-0">
      <ScrollArea type="always" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
        <div className="grid gap-6 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 text-base text-foreground">
              <AppBrand />
            </div>
            <div className="flex shrink-0 items-center">
              <ThemeToggle />
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={copy.closeInfo} onClick={onClose}>
                <X />
              </Button>
            </div>
          </div>
          {(title.length > 0 || presentation.address) && <div className="grid gap-1">
            {presentation.includeProjectName && <h1 className="min-w-0 text-sm font-medium tracking-tight" title={session.brief.project.name}>{session.brief.project.name}</h1>}
            {presentation.includeClientName && <p className="min-w-0 text-sm text-muted-foreground" title={session.brief.project.clientName}>{session.brief.project.clientName}</p>}
            {presentation.includeClientName && presentation.address ? <Separator className="my-2" /> : null}
            {presentation.address ? <p className="min-w-0 text-sm text-muted-foreground" title={presentation.address}>{presentation.address}</p> : null}
          </div>}
          <div className="grid gap-4">
            <ShootTimes brief={session.brief} layout="stack" language={presentation.language} labels={{ shootTimes: copy.shootTimes, totalImages: copy.totalImages }} />
            <div className="grid gap-1">
              <p className="text-sm font-medium">{copy.projectSizes[pdfProjectSize(session.brief)]}</p>
              <p className="text-sm text-muted-foreground">{copy.projectSizeNote}</p>
            </div>
          </div>
          <section className="grid gap-4" aria-label={copy.property}>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{copy.property}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{session.brief.project.description || copy.emptyProperty}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{copy.instructions}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{session.brief.project.instructions || copy.emptyInstructions}</p>
            </div>
          </section>
          <CaptureInstructionsList brief={session.brief} language={presentation.language} isolatedKind={isolatedKind} />
          {session.brief.references.length > 0 && <section className="grid gap-1" aria-label={copy.references}>
            <p className="text-sm font-medium">{copy.references}</p>
            {session.brief.references.map((reference) => {
              const url = referenceImages.sourceUrl(reference)
              const message = typeof reference.source === 'string' ? undefined : referenceImages.resources[reference.source.fileId]?.message
              return <figure key={reference.id} className="grid gap-1">
                {url ? <img src={url} alt={reference.caption} className="max-h-56 w-full rounded-md bg-white object-contain" />
                  : <p className="text-sm text-muted-foreground">{message ?? 'Loading reference image…'}</p>}
                <figcaption className="text-sm text-muted-foreground">{reference.caption}</figcaption>
              </figure>
            })}
          </section>}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
}

import { countBriefImages } from '../model/image-count'
import { formatShootTime, shootSlots, type DroneBrief } from '../model/brief'

export function ShootTimes({ brief, labels = { shootTimes: 'Shoot times', totalImages: 'Total images' } }: {
  brief: DroneBrief
  labels?: { shootTimes: string; totalImages: string }
}) {
  const slots = shootSlots(brief.project)
  const date = slots[0]?.date ?? brief.project.date
  const times = slots.map(formatShootTime).join(', ')
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{labels.shootTimes}</span>
        <time className="text-muted-foreground" dateTime={date}>{date}</time>
        <span className="text-muted-foreground">{times}</span>
      </p>
      <p className="flex items-baseline gap-2">
        <span className="font-medium">{labels.totalImages}</span>
        <span className="text-muted-foreground tabular-nums" aria-label={labels.totalImages}>{countBriefImages(brief).total}</span>
      </p>
    </div>
  )
}

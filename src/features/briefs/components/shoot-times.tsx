import { countBriefImages } from '../model/image-count'
import { formatShootTime, shootSlots, type DroneBrief } from '../model/brief'

export function ShootTimes({ brief }: { brief: DroneBrief }) {
  const slots = shootSlots(brief.project)
  const date = slots[0]?.date ?? brief.project.date
  const times = slots.map(formatShootTime).join(', ')
  return <div className="grid gap-4">
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Shoot times</p>
        <time className="text-sm text-muted-foreground" dateTime={date}>{date}</time>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{times}</p>
    </div>
    <div>
      <p className="text-sm font-medium">Total images</p>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums" aria-label="Total images">{countBriefImages(brief).total}</p>
    </div>
  </div>
}

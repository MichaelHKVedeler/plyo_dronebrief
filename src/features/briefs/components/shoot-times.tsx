import { countBriefImages } from '../model/image-count'
import { formatShootTime, shootSlots, type DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'

export function formatBriefingDate(date: string, language: PdfLanguage) {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  const parts = new Intl.DateTimeFormat(language === 'nb' ? 'nb-NO' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).formatToParts(parsed)
  const day = parts.find((part) => part.type === 'day')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const year = parts.find((part) => part.type === 'year')?.value
  if (!day || !month || !year) return date
  return `${Number(day)}. ${month} ${year}`
}

export function ShootTimes({ brief, labels = { shootTimes: 'Shoot times', totalImages: 'Total images', images: 'images' }, layout = 'inline', language = 'en' }: {
  brief: DroneBrief
  labels?: { shootTimes: string; totalImages: string; images: string }
  layout?: 'inline' | 'stack'
  language?: PdfLanguage
}) {
  const slots = shootSlots(brief.project)
  const date = slots[0]?.date ?? brief.project.date
  const times = slots.map(formatShootTime).join(', ')
  const total = countBriefImages(brief).total
  if (layout === 'stack') {
    // Every time slot is a full shoot of all points, so the total covers each slot.
    const perSlot = total
    const groups: { date: string; times: string[] }[] = []
    for (const slot of slots) {
      const time = formatShootTime(slot)
      const last = groups.at(-1)
      if (last?.date === slot.date) last.times.push(time)
      else groups.push({ date: slot.date, times: [time] })
    }
    return <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium">{labels.shootTimes}</p>
        {groups.map((group) => <div key={group.date} className="grid gap-1">
          <time className="text-sm" dateTime={group.date}>{formatBriefingDate(group.date, language)}</time>
          <ul className="list-disc pl-5 text-sm">
            {group.times.map((time, index) => <li key={`${group.date}-${time}-${index}`}>
              <span className="flex flex-wrap justify-between gap-x-3"><span>{time}</span><span className="tabular-nums text-muted-foreground">{perSlot} {labels.images}</span></span>
            </li>)}
          </ul>
        </div>)}
      </div>
      <div className="grid gap-1">
        <p className="text-sm font-medium">{labels.totalImages}</p>
        <p className="text-sm tabular-nums" aria-label={labels.totalImages}>{perSlot * Math.max(1, slots.length)}</p>
      </div>
    </div>
  }
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{labels.shootTimes}</span>
        <time className="text-muted-foreground" dateTime={date}>{date}</time>
        <span className="text-muted-foreground">{times}</span>
      </p>
      <p className="flex items-baseline gap-2">
        <span className="font-medium">{labels.totalImages}</span>
        <span className="text-muted-foreground tabular-nums" aria-label={labels.totalImages}>{total}</span>
      </p>
    </div>
  )
}

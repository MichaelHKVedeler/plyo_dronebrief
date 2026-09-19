import type { LucideIcon } from 'lucide-react'
import { Circle } from 'lucide-react'
import { cameraLabels, type DroneBrief } from '../model/brief'
import { countBriefImages, imageCaptureConfig } from '../model/image-count'
import { cameraAppearance } from './camera-appearance'

type Row = { key: string; Icon: LucideIcon; label: string; color?: string; className?: string; rule: string; detail: string; images: number }

export function ImageCountSummary({ brief }: { brief: DroneBrief }) {
  const counts = countBriefImages(brief)
  const droneHeights = brief.typeSettings['drone-image'].heightsMeters.length
  const panoramaHeights = brief.typeSettings['360'].heightsMeters.length
  const dronePoints = brief.angles.filter((angle) => angle.type === 'drone-image').length
  const panoramaPoints = brief.angles.filter((angle) => angle.type === '360').length
  const dslrPoints = brief.angles.filter((angle) => angle.type === 'dslr').length
  const rows: Row[] = [
    {
      key: 'circleRig', Icon: Circle, label: 'Circle rig', className: 'text-primary',
      rule: `${imageCaptureConfig.circleRigPerArrowAndHeight} per arrow, height, and time`,
      detail: `${brief.circleRig?.arrowCount ?? 0} arrows · ${droneHeights} heights · ${counts.times} times`,
      images: counts.circleRig,
    },
    {
      key: 'drone-image', Icon: cameraAppearance['drone-image'].Icon, label: cameraLabels['drone-image'],
      color: cameraAppearance['drone-image'].color,
      rule: `${imageCaptureConfig.droneImagePerPointAndHeight} per point, height, and time`,
      detail: `${dronePoints} points · ${droneHeights} heights · ${counts.times} times`,
      images: counts.droneImage,
    },
    {
      key: '360', Icon: cameraAppearance['360'].Icon, label: cameraLabels['360'], color: cameraAppearance['360'].color,
      rule: `${imageCaptureConfig.panoramaPerPointAndHeight} per point, height, and time`,
      detail: `${panoramaPoints} points · ${panoramaHeights} heights · ${counts.times} times`,
      images: counts.panorama,
    },
    {
      key: 'dslr', Icon: cameraAppearance.dslr.Icon, label: cameraLabels.dslr, color: cameraAppearance.dslr.color,
      rule: `${imageCaptureConfig.dslrPerArrow} per arrow and time`,
      detail: `${dslrPoints} points · ${brief.typeSettings.dslr.angleCount} arrows · ${counts.times} times`,
      images: counts.dslr,
    },
  ]
  return <div className="grid gap-4" role="region" aria-label="Image count">
    <ul className="grid gap-3">
      {rows.map((row) => <li key={row.key} className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <row.Icon aria-hidden className={'mt-0.5 size-4 shrink-0 ' + (row.className ?? '')} style={row.color ? { color: row.color } : undefined} />
          <div className="min-w-0">
            <p className="font-medium">{row.label}</p>
            <p className="text-muted-foreground text-xs">{row.rule}</p>
            <p className="text-muted-foreground text-xs">{row.detail}</p>
          </div>
        </div>
        <p className="font-medium tabular-nums" aria-label={row.label + ' count'}>{row.images}</p>
      </li>)}
    </ul>
    <div className="flex items-baseline justify-between gap-3 border-t pt-3">
      <p className="font-medium">Total images</p>
      <p className="font-medium tabular-nums" aria-label="Image count total">{counts.total}</p>
    </div>
  </div>
}

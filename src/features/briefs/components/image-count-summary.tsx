import { cameraLabels, effectivePanoramaHeights, type DroneBrief } from '../model/brief'
import { countBriefImages, imageCaptureConfig } from '../model/image-count'
import { CaptureKindGlyph } from './capture-kind-glyph'

export function ImageCountSummary({ brief }: { brief: DroneBrief }) {
  const counts = countBriefImages(brief)
  const droneHeights = brief.typeSettings['drone-image'].heightsMeters.length
  const panoramaLevels = brief.angles.flatMap((angle) => angle.type === '360'
    ? [effectivePanoramaHeights(brief.typeSettings['360'].heightsMeters, angle).length] : [])
  const panoramaHeightLabel = !panoramaLevels.length || panoramaLevels.every((count) => count === panoramaLevels[0])
    ? `${panoramaLevels[0] ?? brief.typeSettings['360'].heightsMeters.length} heights`
    : 'heights vary'
  const dronePoints = brief.angles.filter((angle) => angle.type === 'drone-image').length
  const panoramaPoints = brief.angles.filter((angle) => angle.type === '360').length
  const dslrPoints = brief.angles.filter((angle) => angle.type === 'dslr').length
  const rows = [
    {
      key: 'circleRig' as const, label: 'Circle rig',
      rule: `${imageCaptureConfig.circleRigPerArrowAndHeight} per arrow, height, and time`,
      detail: `${brief.circleRig?.arrowCount ?? 0} arrows · ${droneHeights} heights · ${counts.times} times`,
      images: counts.circleRig,
    },
    {
      key: 'drone-image' as const, label: cameraLabels['drone-image'],
      rule: `${imageCaptureConfig.droneImagePerPointAndHeight} per point, height, and time`,
      detail: `${dronePoints} points · ${droneHeights} heights · ${counts.times} times`,
      images: counts.droneImage,
    },
    {
      key: '360' as const, label: cameraLabels['360'],
      rule: `${imageCaptureConfig.panoramaPerPointAndHeight} per point, height, and time`,
      detail: `${panoramaPoints} points · ${panoramaHeightLabel} · ${counts.times} times`,
      images: counts.panorama,
    },
    {
      key: 'dslr' as const, label: cameraLabels.dslr,
      rule: `${imageCaptureConfig.dslrPerArrow} per arrow and time`,
      detail: `${dslrPoints} points · ${brief.typeSettings.dslr.angleCount} arrows · ${counts.times} times`,
      images: counts.dslr,
    },
  ]
  return <div className="grid gap-4" role="region" aria-label="Image count">
    <ul className="grid gap-3">
      {rows.map((row) => <li key={row.key} className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CaptureKindGlyph kind={row.key} />
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

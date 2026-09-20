import type { DroneBrief } from '../model/brief'
import { countBriefImages } from '../model/image-count'
import type { PdfLanguage } from '../export/pdf-copy'
import { briefingCopy } from './briefing-copy'

export type CaptureInstructionRow = {
  key: 'circleRig' | 'drone-image' | '360' | 'dslr'
  label: string
  rule: string
  detail: string
  images: number
}

export function pointRangeLabel(label: string, count: number) {
  return count <= 1 ? `${label} 1` : `${label} 1-${count}`
}

export function formatCaptureHeights(heights: number[]) {
  return heights.map((height) => `${height}m`).join(', ')
}

export function captureInstructions(brief: DroneBrief, language: PdfLanguage): CaptureInstructionRow[] {
  const copy = briefingCopy[language]
  const counts = countBriefImages(brief)
  const droneHeights = formatCaptureHeights(brief.typeSettings['drone-image'].heightsMeters)
  const panoramaHeights = formatCaptureHeights(brief.typeSettings['360'].heightsMeters)
  const dronePoints = brief.angles.filter((angle) => angle.type === 'drone-image').length
  const panoramaPoints = brief.angles.filter((angle) => angle.type === '360').length
  const dslrPoints = brief.angles.filter((angle) => angle.type === 'dslr').length
  const rows: CaptureInstructionRow[] = []
  if (brief.circleRig) {
    rows.push({
      key: 'circleRig',
      label: copy.rig,
      rule: copy.rigRule,
      detail: `${pointRangeLabel(copy.arrows, brief.circleRig.arrowCount)}: ${droneHeights}`,
      images: counts.circleRig,
    })
  }
  if (dronePoints) {
    rows.push({
      key: 'drone-image',
      label: copy.drone,
      rule: copy.droneRule,
      detail: `${pointRangeLabel(copy.point, dronePoints)}: ${droneHeights}`,
      images: counts.droneImage,
    })
  }
  if (panoramaPoints) {
    rows.push({
      key: '360',
      label: copy.panorama,
      rule: copy.panoramaRule,
      detail: `${pointRangeLabel(copy.point, panoramaPoints)}: ${panoramaHeights}`,
      images: counts.panorama,
    })
  }
  if (dslrPoints) {
    const { angleCount, spacingDegrees } = brief.typeSettings.dslr
    rows.push({
      key: 'dslr',
      label: copy.dslr,
      rule: copy.dslrRule(angleCount * spacingDegrees, angleCount),
      detail: `${pointRangeLabel(copy.point, dslrPoints)}: ${copy.ground}`,
      images: counts.dslr,
    })
  }
  return rows
}

import type { DroneBrief } from '../model/brief'
import { numberedCameras } from '../model/camera-numbers'
import { rigArrows } from '@/features/map/geometry'

export type PdfProjectSize = 'mini' | 'small' | 'medium' | 'large'

export function pdfProjectPosition(brief: DroneBrief) {
  return brief.circleRig?.position ?? brief.angles[0]?.position ?? brief.coordinates
}

/** Smallest template tier that contains the actual capture plan, not image totals. */
export function pdfProjectSize(brief: DroneBrief): PdfProjectSize {
  const aerial = (brief.circleRig?.arrowCount ?? 0) + brief.angles.filter((a) => a.type === 'drone-image').length
  const panorama = brief.angles.filter((a) => a.type === '360').length
  const dslr = brief.angles.filter((a) => a.type === 'dslr').length
  const aerialHeights = aerial ? brief.typeSettings['drone-image'].heightsMeters.length : 0
  const panoramaHeights = panorama ? brief.typeSettings['360'].heightsMeters.length : 0
  // Mini differs between the reference languages (one vs two 360 heights).
  // Use the more inclusive two-height limit consistently in both languages.
  if (aerial <= 2 && panorama <= 1 && dslr === 0 && aerialHeights <= 2 && panoramaHeights <= 2) return 'mini'
  if (aerial <= 8 && panorama <= 4 && dslr <= 3 && aerialHeights <= 2 && panoramaHeights <= 4) return 'small'
  if (aerial <= 10 && panorama <= 8 && dslr <= 6 && aerialHeights <= 2 && panoramaHeights <= 6) return 'medium'
  return 'large'
}

export function pdfCapturePoints(brief: DroneBrief) {
  const rig = brief.circleRig
  return [
    ...(rig ? [{ label: 'R0', position: rig.position, direction: undefined as number | undefined, fov: undefined as number | undefined },
      ...rigArrows(rig).map((a) => ({ label: `R${a.number}`, position: a.position, direction: a.directionDegrees, fov: undefined as number | undefined }))] : []),
    ...numberedCameras(brief.angles).map(({ angle, number }) => ({
      label: `${angle.type === 'drone-image' ? 'D' : angle.type === '360' ? 'P' : 'S'}${number}`,
      position: angle.position,
      direction: angle.type === '360' ? angle.focus?.directionDegrees : angle.directionDegrees,
      fov: angle.type === '360' ? angle.focus?.fovDegrees : undefined,
    })),
  ]
}

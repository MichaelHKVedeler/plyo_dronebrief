import { effectiveRigHeights, effectivePanoramaHeights, shootSlots, type DroneBrief } from './brief'

/** Locked capture multipliers. Circle rigs use their own heights, with a legacy drone-height fallback. */
export const imageCaptureConfig = {
  circleRigPerArrowAndHeight: 1,
  droneImagePerPointAndHeight: 1,
  panoramaPerPointAndHeight: 10,
  dslrPerArrow: 1,
} as const

export type BriefImageCounts = {
  times: number
  circleRig: number
  droneImage: number
  extraCoverage: number
  panorama: number
  dslr: number
  total: number
}

export function countBriefImages(brief: DroneBrief): BriefImageCounts {
  const times = shootSlots(brief.project).length
  const droneHeights = brief.typeSettings['drone-image'].heightsMeters.length
  const sharedPanoramaHeights = brief.typeSettings['360'].heightsMeters
  let dronePoints = 0, panoramaHeightSlots = 0, dslrPoints = 0
  for (const angle of brief.angles) {
    if (angle.type === 'drone-image') dronePoints += 1
    else if (angle.type === '360') panoramaHeightSlots += effectivePanoramaHeights(sharedPanoramaHeights, angle).length
    else if (angle.type === 'dslr') dslrPoints += 1
  }
  const circleRig = (brief.circleRig
    ? imageCaptureConfig.circleRigPerArrowAndHeight * brief.circleRig.arrowCount * effectiveRigHeights(brief).length : 0) * times
  const droneImage = imageCaptureConfig.droneImagePerPointAndHeight * dronePoints * droneHeights * times
  const extraCoverage = 0 // Scan markers have no capture heights or image count.
  const panorama = imageCaptureConfig.panoramaPerPointAndHeight * panoramaHeightSlots * times
  const dslr = imageCaptureConfig.dslrPerArrow * dslrPoints * brief.typeSettings.dslr.angleCount * times
  return { times, circleRig, droneImage, extraCoverage, panorama, dslr, total: circleRig + droneImage + extraCoverage + panorama + dslr }
}

import { effectivePanoramaHeights, shootSlots, type DroneBrief } from './brief'

/** Locked capture multipliers. Circle rigs use drone-image heights. */
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
    else dslrPoints += 1
  }
  const circleRig = (brief.circleRig
    ? imageCaptureConfig.circleRigPerArrowAndHeight * brief.circleRig.arrowCount * droneHeights : 0) * times
  const droneImage = imageCaptureConfig.droneImagePerPointAndHeight * dronePoints * droneHeights * times
  const panorama = imageCaptureConfig.panoramaPerPointAndHeight * panoramaHeightSlots * times
  const dslr = imageCaptureConfig.dslrPerArrow * dslrPoints * brief.typeSettings.dslr.angleCount * times
  return { times, circleRig, droneImage, panorama, dslr, total: circleRig + droneImage + panorama + dslr }
}

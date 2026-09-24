import { expect, it } from 'vitest'
import { createBrief } from './brief'
import { countBriefImages, imageCaptureConfig } from './image-count'

const position = { lat: 59.9, lng: 10.7 }

function briefWith(overrides: Partial<ReturnType<typeof createBrief>> = {}) {
  return { ...createBrief({ name: 'Count', clientName: 'Test', date: '2026-09-12', times: ['12:00'] }), ...overrides }
}

it('keeps the 360 multiplier locked at ten images per point and height', () => {
  expect(imageCaptureConfig).toEqual({
    circleRigPerArrowAndHeight: 1, droneImagePerPointAndHeight: 1, panoramaPerPointAndHeight: 10, dslrPerArrow: 1,
  })
})

it('counts zero images for an empty brief', () => {
  expect(countBriefImages(briefWith())).toEqual({ times: 1, circleRig: 0, droneImage: 0, panorama: 0, dslr: 0, total: 0 })
})

it('multiplies circle-rig arrows by drone heights and skips a missing rig', () => {
  const rig = { id: 'rig', position, arrowCount: 10, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0 }
  expect(countBriefImages(briefWith({ circleRig: rig })).circleRig).toBe(20)
  expect(countBriefImages(briefWith({
    circleRig: rig,
    typeSettings: {
      ...briefWith().typeSettings,
      'drone-image': { heightsMeters: [] },
    },
  })).circleRig).toBe(0)
})

it('counts drone, 360, and DSLR images from the locked capture rules', () => {
  const brief = briefWith({
    circleRig: { id: 'rig', position, arrowCount: 8, radiusMeters: 40, ovalRatio: 1, rotationDegrees: 0 },
    angles: [
      { id: 'd1', label: 'D1', type: 'drone-image', position, directionDegrees: 0 },
      { id: 'd2', label: 'D2', type: 'drone-image', position, directionDegrees: 90 },
      { id: 'p1', label: 'P1', type: '360', position },
      { id: 's1', label: 'S1', type: 'dslr', position, directionDegrees: 45 },
      { id: 's2', label: 'S2', type: 'dslr', position, directionDegrees: 180 },
    ],
    typeSettings: {
      'drone-image': { heightsMeters: [40, 60] },
      '360': { heightsMeters: [2, 5, 8] },
      dslr: { heightsMeters: [1.6, 2], angleCount: 3, spacingDegrees: 30 },
    },
  })
  expect(countBriefImages(brief)).toEqual({
    times: 1, circleRig: 16, droneImage: 4, panorama: 30, dslr: 6, total: 56,
  })
})

it('counts each 360 point from its own height override', () => {
  const brief = briefWith({
    angles: [
      { id: 'p1', label: 'P1', type: '360', position },
      { id: 'p2', label: 'P2', type: '360', position, heightsMeters: [11] },
    ],
  })
  expect(countBriefImages(brief).panorama).toBe(40)
})

it('multiplies every capture count by the number of shoot times', () => {
  const brief = briefWith({
    project: {
      ...briefWith().project,
      times: ['09:00', '12:00', '17:00'],
      shoots: [
        { date: '2026-09-12', time: '09:00' },
        { date: '2026-09-12', time: '12:00' },
        { date: '2026-09-12', time: '17:00' },
      ],
    },
    circleRig: { id: 'rig', position, arrowCount: 8, radiusMeters: 40, ovalRatio: 1, rotationDegrees: 0 },
    angles: [
      { id: 'd1', label: 'D1', type: 'drone-image', position, directionDegrees: 0 },
      { id: 'p1', label: 'P1', type: '360', position },
      { id: 's1', label: 'S1', type: 'dslr', position, directionDegrees: 45 },
    ],
  })
  expect(countBriefImages(brief)).toEqual({
    times: 3, circleRig: 48, droneImage: 6, panorama: 90, dslr: 3, total: 147,
  })
})

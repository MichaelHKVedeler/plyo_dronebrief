import { expect, it } from 'vitest'
import { defaultVisibility, type CameraAngle } from '@/features/briefs/model/brief'
import { isolatedCaptureAngles, isolatedCaptureVisibility, toggleIsolatedCapture } from './isolated-capture'

const angles: CameraAngle[] = [
  { id: 'd1', label: 'D1', type: 'drone-image', position: { lat: 59, lng: 10 }, directionDegrees: 0 },
  { id: 'p1', label: 'P1', type: '360', position: { lat: 59, lng: 10 } },
  { id: 's1', label: 'S1', type: 'dslr', position: { lat: 59, lng: 10 }, directionDegrees: 90 },
]

it('toggles one capture kind on and off', () => {
  expect(toggleIsolatedCapture(null, 'drone-image')).toBe('drone-image')
  expect(toggleIsolatedCapture('drone-image', 'drone-image')).toBeNull()
  expect(toggleIsolatedCapture('drone-image', 'dslr')).toBe('dslr')
})

it('hides other capture types while isolated and keeps layer toggles', () => {
  expect(isolatedCaptureVisibility(defaultVisibility, 'drone-image')).toEqual({ circleRig: false, angles: true, droneScan: false })
  expect(isolatedCaptureVisibility(defaultVisibility, 'circleRig')).toEqual({ circleRig: true, angles: false, droneScan: false })
  expect(isolatedCaptureVisibility(defaultVisibility, 'droneScan')).toEqual({ circleRig: false, angles: true, droneScan: true })
  expect(isolatedCaptureVisibility({ ...defaultVisibility, angles: false }, 'drone-image')).toEqual({ circleRig: false, angles: false, droneScan: false })
  expect(isolatedCaptureVisibility({ ...defaultVisibility, circleRig: false, droneScan: false }, null)).toEqual({ circleRig: false, angles: true, droneScan: false })
})

it('filters camera points to the isolated type', () => {
  expect(isolatedCaptureAngles(angles, null).map((angle) => angle.id)).toEqual(['d1', 'p1', 's1'])
  expect(isolatedCaptureAngles(angles, 'drone-image').map((angle) => angle.id)).toEqual(['d1'])
  expect(isolatedCaptureAngles(angles, 'circleRig')).toEqual([])
  expect(isolatedCaptureAngles(angles, 'droneScan')).toEqual([])
})

it('keeps shared-link scan and normal captures mutually exclusive through toggles', () => {
  const all: CameraAngle[] = [...angles, { id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: { lat: 59, lng: 10 } }]
  for (const kind of [null, 'droneScan', null, 'dslr', 'droneScan', 'circleRig'] as const) {
    const layers = isolatedCaptureVisibility(defaultVisibility, kind, true)
    const points = isolatedCaptureAngles(all, kind, true)
    expect(layers.droneScan).toBe(kind === 'droneScan')
    expect(points.some((angle) => angle.type === 'extra-coverage')).toBe(kind === 'droneScan')
    if (kind === 'droneScan') {
      expect(points.map((angle) => angle.id)).toEqual(['extra'])
      expect(layers.circleRig).toBe(false)
    } else expect(points.every((angle) => angle.type !== 'extra-coverage')).toBe(true)
  }
})

it('uses the drone scan layer for extra coverage independently of normal camera visibility in the editor', () => {
  const all: CameraAngle[] = [...angles, { id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: { lat: 59, lng: 10 } }]
  expect(isolatedCaptureAngles(all, null)).toEqual(all)
  const scanOnly = { ...defaultVisibility, angles: false }
  expect(isolatedCaptureVisibility(scanOnly, null).angles).toBe(true)
  expect(isolatedCaptureAngles(all, null, false, scanOnly).map((angle) => angle.id)).toEqual(['extra'])
  expect(isolatedCaptureAngles(all, null, false, { ...defaultVisibility, droneScan: false })).toEqual(angles)
})

it('splits drone scan circles from extra coverage points for drone scan links', () => {
  const all: CameraAngle[] = [...angles, { id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: { lat: 59, lng: 10 } }]
  expect(isolatedCaptureVisibility(defaultVisibility, 'scanCircles', true)).toEqual({ circleRig: false, angles: false, droneScan: true })
  expect(isolatedCaptureAngles(all, 'scanCircles', true)).toEqual([])
  expect(isolatedCaptureVisibility(defaultVisibility, 'extra-coverage', true)).toEqual({ circleRig: false, angles: true, droneScan: false })
  expect(isolatedCaptureAngles(all, 'extra-coverage', true).map((angle) => angle.id)).toEqual(['extra'])
})

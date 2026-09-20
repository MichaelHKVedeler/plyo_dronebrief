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
  expect(isolatedCaptureVisibility(defaultVisibility, 'drone-image')).toEqual({ circleRig: false, angles: true })
  expect(isolatedCaptureVisibility(defaultVisibility, 'circleRig')).toEqual({ circleRig: true, angles: false })
  expect(isolatedCaptureVisibility({ ...defaultVisibility, angles: false }, 'drone-image')).toEqual({ circleRig: false, angles: false })
  expect(isolatedCaptureVisibility({ ...defaultVisibility, circleRig: false }, null)).toEqual({ circleRig: false, angles: true })
})

it('filters camera points to the isolated type', () => {
  expect(isolatedCaptureAngles(angles, null).map((angle) => angle.id)).toEqual(['d1', 'p1', 's1'])
  expect(isolatedCaptureAngles(angles, 'drone-image').map((angle) => angle.id)).toEqual(['d1'])
  expect(isolatedCaptureAngles(angles, 'circleRig')).toEqual([])
})

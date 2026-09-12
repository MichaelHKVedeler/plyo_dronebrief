import { expect, it } from 'vitest'
import type { CameraAngle } from './brief'
import { numberedCameras, nextCameraNumber } from './camera-numbers'

it('numbers each category independently and closes gaps after removal without changing labels', () => {
  const types: CameraAngle['type'][] = ['drone-image', 'dslr', 'drone-image', '360', 'drone-image']
  const angles: CameraAngle[] = types.map((type, index) => {
    const base = { id: String(index), label: 'Custom ' + index, position: { lat: 60, lng: 10 } }
    return type === '360' ? { ...base, type } : { ...base, type, directionDegrees: 0 }
  })
  expect(numberedCameras(angles).map(({ number }) => number)).toEqual([1, 1, 2, 1, 3])
  expect(nextCameraNumber(angles, 'dslr')).toBe(2)
  expect(nextCameraNumber(angles, 'drone-image')).toBe(4)
  const remaining = angles.filter((angle) => angle.id !== '0')
  expect(numberedCameras(remaining).map(({ number }) => number)).toEqual([1, 1, 1, 2])
  expect(angles[0].label).toBe('Custom 0')
})

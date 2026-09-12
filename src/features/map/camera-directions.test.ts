import { expect, it } from 'vitest'
import { maxDslrAngles, maxDslrSpacing, minDslrSpacing } from '@/features/briefs/model/brief'
import { cameraDirectionLayout } from './camera-directions'

it('centers each fan on the saved bearing and keeps all arrows at the same fixed distance', () => {
  expect(cameraDirectionLayout()).toEqual({ offsets: [0], radiusPixels: 40 })
  expect(cameraDirectionLayout({ angleCount: 3, spacingDegrees: 30 }).offsets).toEqual([-30, 0, 30])
  for (let angleCount = 1; angleCount <= maxDslrAngles; angleCount++) {
    for (const spacingDegrees of [minDslrSpacing, 30, maxDslrSpacing(angleCount)]) {
      const { offsets, radiusPixels } = cameraDirectionLayout({ angleCount, spacingDegrees })
      expect(offsets.reduce((total, offset) => total + offset, 0)).toBe(0)
      expect(radiusPixels).toBe(40)
    }
  }
})

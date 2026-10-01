import { expect, it } from 'vitest'
import { briefSchema, createBrief, imageMaskSchema, type ImageMask } from './brief'
import { moveMaskPoints } from './image-mask'
import { openSession, reduceSession } from '../state/brief-session'
import { exportBriefKey, importBriefKey } from '../storage/share-key'
import { briefRepository } from '../storage/brief-repository'

const mask: ImageMask = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }]
it('preserves masks through session updates, storage and portable keys without changing old briefs', () => {
  const brief = createBrief({ name: 'Mask', clientName: 'Test' })
  brief.imageOverlays.push({ id: 'plan', name: 'Plan', source: 'data:image/png;base64,AAAA', position: brief.coordinates, widthMeters: 100, heightMeters: 50, rotationDegrees: 0, opacity: 1 })
  expect(briefSchema.parse(brief).imageOverlays[0].mask).toBeUndefined()
  const action = { type: 'update' as const, update: (value: typeof brief) => ({ ...value, imageOverlays: value.imageOverlays.map((image) => ({ ...image, mask })) }) }
  const edited = reduceSession(openSession(brief, 'edit'), action).brief
  briefRepository.save(edited)
  expect(briefRepository.latest()?.imageOverlays[0].mask).toEqual(mask)
  expect(importBriefKey(exportBriefKey(edited)).imageOverlays[0].mask).toEqual(mask)
  const viewer = openSession(brief, 'view')
  expect(reduceSession(viewer, action)).toBe(viewer)
})
it('rejects incomplete, oversized and invalid normalized polygons', () => {
  for (const invalid of [mask.slice(0, 2), [...mask, { x: -0.1, y: 0 }], [...mask, { x: 0, y: Infinity }], Array(1001).fill(mask[0])]) {
    expect(imageMaskSchema.safeParse(invalid).success).toBe(false)
  }
})
it('moves both endpoints together at the image bounds without mutating the original', () => {
  const moved = moveMaskPoints(mask, [0, 1], 0.7, -0.5)
  expect(moved[1]).toEqual({ x: 1, y: 0 })
  expect(moved[1].x - moved[0].x).toBeCloseTo(0.6)
  expect(moved[2]).toEqual(mask[2])
  expect(mask[0]).toEqual({ x: 0.2, y: 0.2 })
})

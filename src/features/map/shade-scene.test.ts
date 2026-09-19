import { expect, it } from 'vitest'
import { createBrief, defaultVisibility } from '@/features/briefs/model/brief'
import { shadeScene } from './shade-scene'

it('preserves rig geometry and omits hidden layers and 360 directions without changing the brief', () => {
  const brief = createBrief({ name: 'Test', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
  brief.circleRig = { id: 'rig', position: brief.coordinates, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.6, rotationDegrees: 45 }
  brief.angles = [
    { id: 'a', label: '360', type: '360', position: brief.coordinates },
    { id: 'b', label: 'DSLR', type: 'dslr', position: brief.coordinates, directionDegrees: 120 },
  ]
  const original = structuredClone(brief)
  const scene = shadeScene(brief, defaultVisibility, 17)
  expect(scene.features.map((f) => f.geometry.type)).toEqual(['Polygon', 'LineString'])
  expect(shadeScene(brief, { ...defaultVisibility, circleRig: false, angles: false }, 17).features).toEqual([])
  expect(brief).toEqual(original)
})

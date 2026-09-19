import { expect, it } from 'vitest'
import { createBrief } from '../model/brief'
import { pdfCapturePoints, pdfProjectPosition, pdfProjectSize } from './pdf-project'

function briefWith(aerial: number, panorama: number, dslr: number, heightCount = 2) {
  const brief = createBrief({ name: 'Size', clientName: 'Client' })
  brief.typeSettings['360'].heightsMeters = Array.from({ length: heightCount }, (_, i) => i * 3)
  brief.angles = [
    ...Array.from({ length: aerial }, (_, i) => ({ type: 'drone-image' as const, id: `d${i}`, label: 'D', position: brief.coordinates, directionDegrees: 90 })),
    ...Array.from({ length: panorama }, (_, i) => ({ type: '360' as const, id: `p${i}`, label: 'P', position: brief.coordinates })),
    ...Array.from({ length: dslr }, (_, i) => ({ type: 'dslr' as const, id: `s${i}`, label: 'S', position: brief.coordinates, directionDegrees: 45 })),
  ]
  return brief
}
it.each([
  [2, 1, 0, 2, 'mini'], [2, 1, 1, 2, 'small'], [8, 4, 3, 4, 'small'],
  [9, 4, 3, 4, 'medium'], [10, 8, 6, 6, 'medium'], [11, 8, 6, 6, 'large'],
  [2, 1, 0, 7, 'large'], [50, 100, 100, 8, 'large'],
] as const)('classifies %i aerial / %i panoramas / %i DSLR with %i heights as %s', (a, p, s, h, size) => {
  expect(pdfProjectSize(briefWith(a, p, s, h))).toBe(size)
})
it('includes rig positions in the size and coordinate list, using the rig for location', () => {
  const brief = briefWith(1, 1, 1)
  brief.circleRig = { id: 'r', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 80, ovalRatio: .5, rotationDegrees: 30 }
  expect(pdfProjectSize(brief)).toBe('large')
  expect(pdfProjectPosition(brief)).toEqual(brief.circleRig.position)
  const points = pdfCapturePoints(brief)
  expect(points).toHaveLength(14)
  expect(points.map((p) => p.label)).toEqual(['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'D1', 'P1', 'S1'])
  expect(points[0].position).toEqual(brief.circleRig.position)
  expect(points[1].position).not.toEqual(brief.circleRig.position)
  expect(points[1].direction).toBeGreaterThanOrEqual(0)
})
it('uses the first camera, then the project coordinate if there is no rig', () => {
  const brief = briefWith(1, 0, 0)
  brief.angles[0].position = { lat: 40, lng: -74 }
  expect(pdfProjectPosition(brief)).toEqual({ lat: 40, lng: -74 })
  brief.angles = []
  expect(pdfProjectPosition(brief)).toEqual(brief.coordinates)
})

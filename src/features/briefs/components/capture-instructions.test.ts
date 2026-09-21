import { expect, it } from 'vitest'
import { createBrief } from '../model/brief'
import { captureInstructions, formatCaptureHeights, pointRangeLabel } from './capture-instructions'

function briefWithPoints() {
  const brief = createBrief({ name: 'Capture', clientName: 'Client' })
  brief.circleRig = { id: 'rig', position: brief.coordinates, arrowCount: 10, radiusMeters: 40, ovalRatio: 1, rotationDegrees: 0 }
  brief.angles = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, label: `D${i}`, type: 'drone-image' as const, position: brief.coordinates, directionDegrees: 0 })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, type: '360' as const, position: brief.coordinates })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, type: 'dslr' as const, position: brief.coordinates, directionDegrees: 90 })),
  ]
  brief.typeSettings = {
    'drone-image': { heightsMeters: [40, 60] },
    '360': { heightsMeters: [2, 5, 8] },
    dslr: { heightsMeters: [1.6], angleCount: 6, spacingDegrees: 30 },
  }
  return brief
}

it('formats point ranges and compact meter lists', () => {
  expect(pointRangeLabel('Point', 1)).toBe('Point 1')
  expect(pointRangeLabel('Point', 8)).toBe('Point 1-8')
  expect(formatCaptureHeights([40, 60])).toBe('40m, 60m')
  expect(formatCaptureHeights([0, 0, 0, 0])).toBe('0m, 0m, 0m, 0m')
})

it('describes existing capture types with counts in English', () => {
  const rows = captureInstructions(briefWithPoints(), 'en')
  expect(rows).toEqual([
    { key: 'circleRig', label: 'Circle rig', rule: '1 photo per arrow and height', range: 'Arrows 1-10', heights: '40m, 60m', images: 20 },
    { key: 'drone-image', label: 'Aerial photo', rule: 'Maximum height of 120m', range: 'Point 1-8', heights: '40m, 60m', images: 16 },
    { key: '360', label: '360°', rule: 'Not stitched panorama, individual photos', range: 'Point 1-4', heights: '2m, 5m, 8m', images: 120 },
    { key: 'dslr', label: 'DSLR', rule: '180°, minimum 6 photos per point', range: 'Point 1-3', heights: 'Ground-level', images: 18 },
  ])
})

it('omits empty types and translates Norwegian copy', () => {
  const brief = createBrief({ name: 'Empty', clientName: 'Client' })
  brief.angles = [{ id: 's1', label: 'S1', type: 'dslr', position: brief.coordinates, directionDegrees: 45 }]
  brief.typeSettings.dslr = { heightsMeters: [1.6], angleCount: 1, spacingDegrees: 30 }
  expect(captureInstructions(brief, 'nb')).toEqual([
    { key: 'dslr', label: 'DSLR', rule: '30°, minst 1 foto per punkt', range: 'Punkt 1', heights: 'Bakkenivå', images: 1 },
  ])
})

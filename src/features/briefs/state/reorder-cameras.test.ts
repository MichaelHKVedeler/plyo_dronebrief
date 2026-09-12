import { expect, it } from 'vitest'
import { createBrief } from '../model/brief'
import { openSession, reduceSession } from './brief-session'
import { reorderCameras } from './reorder-cameras'

it('reorders only the chosen category and preserves point identities, geometry and legacy labels', () => {
  const brief = createBrief({ name: 'Order', clientName: 'Test', date: '2026-09-12', times: ['12:00'] })
  brief.angles = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: 'Legacy ' + id, type: id === 'b' ? 'dslr' : 'drone-image', position: brief.coordinates, directionDegrees: 90 }))
  const updated = reorderCameras(brief, 'd', 'a')
  expect(updated.angles.map((angle) => angle.id)).toEqual(['d', 'b', 'c', 'a'])
  const swapped = reorderCameras(brief, 'a', 'd')
  expect(swapped.angles.map((angle) => angle.id)).toEqual(['d', 'b', 'c', 'a'])
  expect(swapped.angles[1]).toBe(brief.angles[1])
  expect(swapped.angles[2]).toBe(brief.angles[2])
  expect(reorderCameras(brief, 'a', 'b')).toBe(brief)
  expect(updated.angles[0]).toBe(brief.angles[3])
  expect(brief.angles.map((angle) => angle.id)).toEqual(['a', 'b', 'c', 'd'])
  expect(reorderCameras(brief, 'a', 'b')).toBe(brief)
  expect(reorderCameras(brief, 'missing', 'a')).toBe(brief)
  const viewer = openSession(brief, 'view')
  expect(reduceSession(viewer, { type: 'update', update: (value) => reorderCameras(value, 'd', 'a') })).toBe(viewer)
})

// @vitest-environment node
import { expect, it } from 'vitest'
import { createBrief } from '../../src/features/briefs/model/brief'
import { decodeBody, encodeBody } from './body'

it('round-trips valid bodies beyond the Firestore single-document limit, including Unicode', () => {
  const brief = createBrief({ name: 'Øst 🛰️', clientName: 'Client' })
  brief.imageOverlays = [{ id: 'legacy', name: 'Legacy', source: 'data:image/png;base64,' + 'AAAA'.repeat(280000), position: brief.coordinates, widthMeters: 10, heightMeters: 10, rotationDegrees: 0, opacity: 1 }]
  const chunks = encodeBody({ brief, assets: {} })
  expect(chunks.length).toBeGreaterThan(1)
  expect(chunks.every((chunk) => Buffer.byteLength(chunk) < 1_000_000)).toBe(true)
  expect(decodeBody(chunks)).toEqual({ brief, assets: {} })
})

it('preserves both drone scan circles across cloud body save and reload', () => {
  const brief = createBrief({ name: 'Drone scan persistence', clientName: 'Test' })
  brief.droneScan = {
    id: 'scan',
    highRes: { id: 'high', position: { lat: 59.9139, lng: 10.7522 }, radiusMeters: 250 },
    lowRes: { id: 'low', position: { lat: 59.914, lng: 10.7523 }, radiusMeters: 400 },
  }
  brief.angles = [{ id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: brief.coordinates }]
  const restored = decodeBody(encodeBody({ brief, assets: {} }))
  expect(restored.brief.angles).toEqual(brief.angles)
  expect(restored.brief.droneScan).toEqual(brief.droneScan)
  restored.brief.droneScan!.highRes!.radiusMeters = 275
  expect(decodeBody(encodeBody(restored)).brief.droneScan!.highRes!.radiusMeters).toBe(275)
  restored.brief.droneScan = null
  expect(decodeBody(encodeBody(restored)).brief.droneScan).toBeNull()
})

it('preserves floorplan masks through cloud validation, saving, editing and reloading', () => {
  const brief = createBrief({ name: 'Mask persistence', clientName: 'Test' })
  brief.imageOverlays = [{ id: 'plan', name: 'Plan', source: 'data:image/png;base64,AAAA', position: brief.coordinates,
    widthMeters: 10, heightMeters: 10, rotationDegrees: 0, opacity: 1,
    mask: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .5, y: .9 }],
  }]
  const restored = decodeBody(encodeBody({ brief, assets: {} }))
  expect(restored.brief.imageOverlays[0].mask).toEqual(brief.imageOverlays[0].mask)
  restored.brief.imageOverlays[0].mask![1] = { x: .8, y: .2 }
  expect(decodeBody(encodeBody(restored)).brief.imageOverlays[0].mask![1]).toEqual({ x: .8, y: .2 })
  delete restored.brief.imageOverlays[0].mask
  expect(decodeBody(encodeBody(restored)).brief.imageOverlays[0].mask).toBeUndefined()
})

it('preserves independent circle rig heights through cloud body validation', () => {
  const brief = createBrief({ name: 'Rig heights', clientName: 'Test' })
  brief.circleRig = { id: 'rig', position: brief.coordinates, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0, arrowCount: 10, heightsMeters: [15, 30, 45] }
  expect(decodeBody(encodeBody({ brief, assets: {} })).brief.circleRig?.heightsMeters).toEqual([15, 30, 45])
})

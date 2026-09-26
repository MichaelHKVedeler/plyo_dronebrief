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
  const restored = decodeBody(encodeBody({ brief, assets: {} }))
  expect(restored.brief.droneScan).toEqual(brief.droneScan)
  restored.brief.droneScan!.highRes!.radiusMeters = 275
  expect(decodeBody(encodeBody(restored)).brief.droneScan!.highRes!.radiusMeters).toBe(275)
  restored.brief.droneScan = null
  expect(decodeBody(encodeBody(restored)).brief.droneScan).toBeNull()
})

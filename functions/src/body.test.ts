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

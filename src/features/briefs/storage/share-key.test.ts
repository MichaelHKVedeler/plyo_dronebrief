import { describe, expect, it } from 'vitest'
import { createBrief } from '../model/brief'
import { exportBriefKey, importBriefKey } from './share-key'
import { deflateSync } from 'fflate'

function encoded(bytes: Uint8Array) { return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }

describe('portable brief keys', () => {
  const brief = createBrief({ name: 'Havnekvartalet 🚁', clientName: 'Müller & Søn', date: '2026-09-11', times: ['09:00', '17:30'] })
  it('compresses exports and still loads legacy DB1 snapshots', () => {
    const legacy = 'DB1.' + encoded(new TextEncoder().encode(JSON.stringify(brief)))
    expect(importBriefKey(legacy)).toEqual(brief)
    expect(exportBriefKey(brief)).toMatch(/^DB2\./)
    expect(exportBriefKey(brief).length).toBeLessThan(legacy.length * 0.75)
  })
  it('loads old DSLR snapshots and round-trips shared arrow settings in DB2', () => {
    const legacy = { ...brief, typeSettings: { ...brief.typeSettings, dslr: { heightsMeters: [1.6, 2] } } }
    const restored = importBriefKey('DB1.' + encoded(new TextEncoder().encode(JSON.stringify(legacy))))
    expect(restored.typeSettings.dslr).toEqual({ heightsMeters: [1.6, 2], angleCount: 1, spacingDegrees: 30 })
    restored.typeSettings.dslr = { ...restored.typeSettings.dslr, angleCount: 5, spacingDegrees: 45 }
    expect(importBriefKey(exportBriefKey(restored))).toEqual(restored)
  })
  it('rejects compressed payloads beyond the decompressed size limit and truncated streams', () => {
    const oversized = 'DB2.' + encoded(deflateSync(new TextEncoder().encode(' '.repeat(2_000_001))))
    expect(() => importBriefKey(oversized)).toThrow()
    expect(() => importBriefKey(exportBriefKey(brief).slice(0, -12))).toThrow()
  })
  it('round-trips Unicode and every shape type without external storage', () => {
    const complete = { ...brief,
      circleRig: { id: 'rig', position: { lat: 59.9, lng: 10.7 }, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.5, rotationDegrees: 45 },
      angles: [
        { id: 'a', label: 'Drone', type: 'drone-image' as const, position: brief.coordinates, directionDegrees: 90 },
        { id: 'b', label: 'Panorama', type: '360' as const, position: brief.coordinates },
        { id: 'c', label: 'Street', type: 'dslr' as const, position: brief.coordinates, directionDegrees: 180 },
      ],
      polygons: [{ id: 'p', label: 'Newbuild', vertices: [{ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }, { lat: 0, lng: 0.001 }] }],
      imageOverlays: [{ id: 'i', name: 'Plan', source: 'data:image/png;base64,AAAA', position: brief.coordinates, widthMeters: 50, heightMeters: 30, rotationDegrees: 0, opacity: 0.5 }],
    }
    expect(importBriefKey('  ' + exportBriefKey(complete) + '  ')).toEqual(complete)
  })
  it.each(['invalid', 'DB1.', 'DB1.%%%','DB1.e30', 'DB2.e30'])('rejects malformed or unsupported key %s', (key) => {
    expect(() => importBriefKey(key)).toThrow()
  })
  it('rejects unsupported JSON versions, out-of-range coordinates and oversize input', () => {
    for (const changed of [{ ...brief, schemaVersion: 2 }, { ...brief, coordinates: { lat: 100, lng: 0 } }]) {
      const bytes = new TextEncoder().encode(JSON.stringify(changed))
      const key = 'DB1.' + btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
      expect(() => importBriefKey(key)).toThrow()
    }
    expect(() => importBriefKey('DB1.' + 'a'.repeat(2_700_000))).toThrow('too large')
  })
})

it('defaults legacy rig counts and round-trips explicit counts, rejecting invalid imports', () => {
  const brief = createBrief({ name: 'Rig', clientName: 'Test', date: '2026-09-12', times: ['09:00'] })
  const legacyRig = { id: 'rig', position: brief.coordinates, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0 }
  const key = (rig: object) => 'DB1.' + encoded(new TextEncoder().encode(JSON.stringify({ ...brief, circleRig: rig })))
  const restored = importBriefKey(key(legacyRig))
  expect(restored.circleRig?.arrowCount).toBe(10)
  restored.circleRig!.arrowCount = 23
  expect(importBriefKey(exportBriefKey(restored))).toEqual(restored)
  for (const arrowCount of [0, 51, 2.5, '10', null]) {
    expect(() => importBriefKey(key({ ...legacyRig, arrowCount }))).toThrow()
  }
})

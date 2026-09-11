import { describe, expect, it } from 'vitest'
import { createBrief } from '../model/brief'
import { exportBriefKey, importBriefKey } from './share-key'

describe('portable brief keys', () => {
  const brief = createBrief({ name: 'Havnekvartalet 🚁', clientName: 'Müller & Søn', date: '2026-09-11', times: ['09:00', '17:30'] })
  it('round-trips Unicode and every shape type without external storage', () => {
    const complete = { ...brief,
      circleRig: { id: 'rig', position: { lat: 59.9, lng: 10.7 }, radiusMeters: 80, ovalRatio: 0.5, rotationDegrees: 45 },
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

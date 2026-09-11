import { describe, expect, it } from 'vitest'
import { createBrief } from '@/features/briefs/model/brief'
import { sceneBounds, scenePoints } from './scene-bounds'
import { rigOutline } from './geometry'

describe('scene framing', () => {
  const brief = createBrief({ name: 'Frame test', clientName: 'Client', date: '2026-09-11', times: ['09:00'] })
  it('uses the reference location only for an empty scene', () => {
    expect(scenePoints(brief)).toEqual([brief.coordinates])
    const points = scenePoints({ ...brief, angles: [{ id: 'a', label: 'A', type: '360', position: { lat: 59, lng: 10 } }] })
    expect(points).toEqual([{ lat: 59, lng: 10 }])
  })
  it('includes the entire rotated rig, all cameras, and polygon vertices', () => {
    const rig = { id: 'r', position: { lat: 59, lng: 10 }, radiusMeters: 400, ovalRatio: 0.6, rotationDegrees: 40 }
    const scene = { ...brief, circleRig: rig, angles: [{ id: 'a', label: 'A', type: '360' as const, position: { lat: 60, lng: 11 } }], polygons: [{ id: 'p', label: 'P', vertices: [{ lat: 58, lng: 9 }, { lat: 58.1, lng: 9.1 }, { lat: 58.2, lng: 9.2 }] }] }
    const points = scenePoints(scene)
    expect(points).toEqual(expect.arrayContaining(rigOutline(rig)))
    expect(sceneBounds(points)).toEqual({ north: 60, south: 58, east: 11, west: 9 })
  })
  it('frames nearby points across the antimeridian as a small scene', () => {
    expect(sceneBounds([{ lat: 10, lng: 179.9 }, { lat: 11, lng: -179.9 }])).toEqual({ north: 11, south: 10, east: expect.closeTo(-179.9), west: expect.closeTo(179.9) })
  })
  it('gives a single camera a usable area instead of maximum zoom', () => {
    const bounds = sceneBounds([{ lat: 59, lng: 10 }])
    expect(bounds.north).toBeGreaterThan(59); expect(bounds.south).toBeLessThan(59)
    expect(bounds.east).toBeGreaterThan(10); expect(bounds.west).toBeLessThan(10)
  })
})

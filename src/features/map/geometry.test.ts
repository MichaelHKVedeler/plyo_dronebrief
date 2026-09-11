import { describe, expect, it } from 'vitest'
import { bearingDegrees, destination, distanceMeters, normalizeHeading, pathCenter, reshapeRig, resizeRig, rigOutline, rotateRig, scaleAndRotateRig, type CircleRig } from './geometry'

const rig: CircleRig = { id: 'rig', position: { lat: 59.9, lng: 10.7 }, radiusMeters: 100, ovalRatio: 0.5, rotationDegrees: 35 }
describe('map transform geometry', () => {
  it('anchors the combined scale/rotate handle to the dragged edge point', () => {
    const target = destination(rig.position, 240, 125)
    const changed = scaleAndRotateRig(rig, target)
    expect(changed.radiusMeters).toBeCloseTo(240)
    expect(changed.rotationDegrees).toBeCloseTo(125)
    expect(changed.position).toEqual(rig.position)
    expect(changed.ovalRatio).toBe(rig.ovalRatio)
    expect(distanceMeters(rigOutline(changed)[0], target)).toBeLessThan(0.001)
  })
  it('keeps a valid radius and stable heading when the combined handle reaches the center', () => {
    const changed = scaleAndRotateRig(rig, rig.position)
    expect(changed.radiusMeters).toBe(0.1)
    expect(changed.rotationDegrees).toBe(rig.rotationDegrees)
    expect(scaleAndRotateRig(rig, destination(rig.position, 20000, 270)).radiusMeters).toBe(10000)
  })
  it.each([0, 90, 180, 270, 359])('preserves bearing %s and distance', (heading) => {
    const target = destination(rig.position, 75, heading)
    expect(distanceMeters(rig.position, target)).toBeCloseTo(75, 5)
    const actual = bearingDegrees(rig.position, target)
    expect(Math.min(Math.abs(actual - heading), 360 - Math.abs(actual - heading))).toBeLessThan(0.00001)
  })
  it('handles crossing the antimeridian without an enormous jump', () => {
    const start = { lat: 10, lng: 179.9999 }
    const end = destination(start, 100, 90)
    expect(end.lng).toBeLessThan(0)
    expect(distanceMeters(start, end)).toBeCloseTo(100, 5)
  })
  it('scales the rig while preserving its shape, heading and position', () => {
    const resized = resizeRig(rig, destination(rig.position, 240, 35))
    expect(resized.radiusMeters).toBeCloseTo(240)
    expect(resized.ovalRatio).toBe(rig.ovalRatio)
    expect(resized.rotationDegrees).toBe(rig.rotationDegrees)
    expect(resized.position).toEqual(rig.position)
  })
  it('rotates clockwise from north and preserves the shape', () => {
    const rotated = rotateRig(rig, destination(rig.position, 100, 270))
    expect(rotated.rotationDegrees).toBeCloseTo(270)
    expect(rotated.radiusMeters).toBe(100)
    expect(rotated.ovalRatio).toBe(0.5)
    expect(rotateRig(rig, rig.position)).toBe(rig)
  })
  it('adjusts ovalness in the rotated rig frame', () => {
    const target = destination(rig.position, 40, rig.rotationDegrees + 90)
    expect(reshapeRig(rig, target).ovalRatio).toBeCloseTo(0.8)
    expect(reshapeRig(rig, destination(rig.position, 40, rig.rotationDegrees)).ovalRatio).toBe(0.1)
  })
  it('keeps gizmo output inside schema limits', () => {
    expect(resizeRig(rig, rig.position).radiusMeters).toBe(0.1)
    expect(resizeRig(rig, destination(rig.position, 20000, 0)).radiusMeters).toBe(10000)
    expect(reshapeRig(rig, destination(rig.position, 1000, 125)).ovalRatio).toBe(1)
    expect(normalizeHeading(-5)).toBe(355)
    expect(normalizeHeading(365)).toBe(5)
  })
  it('renders the expected axes and recovers a dragged outline center', () => {
    const outline = rigOutline(rig)
    expect(distanceMeters(rig.position, outline[0])).toBeCloseTo(100, 5)
    expect(distanceMeters(rig.position, outline[16])).toBeCloseTo(50, 5)
    expect(distanceMeters(rig.position, pathCenter(outline))).toBeLessThan(0.001)
    const moved = { ...rig, position: destination(rig.position, 250, 50) }
    expect(distanceMeters(moved.position, pathCenter(rigOutline(moved)))).toBeLessThan(0.001)
  })
})

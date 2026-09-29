import { describe, expect, it } from 'vitest'
import { bearingDegrees, destination, distanceMeters, normalizeHeading, pathCenter, reshapeRig, resizeRig, rigOutline, rigArrows, rigOvalHandle, rigRadiusHandle, rotateRig, scaleAndRotateRig, type CircleRig } from './geometry'

const rig: CircleRig = { id: 'rig', position: { lat: 59.9, lng: 10.7 }, arrowCount: 10, radiusMeters: 100, ovalRatio: 0.5, rotationDegrees: 35 }
describe('map transform geometry', () => {
  it('anchors the combined scale/rotate handle to the dragged edge point', () => {
    const target = rigRadiusHandle({ ...rig, radiusMeters: 240, rotationDegrees: 125 })
    const changed = scaleAndRotateRig(rig, target)
    expect(changed.radiusMeters).toBeCloseTo(240)
    expect(changed.rotationDegrees).toBeCloseTo(125)
    expect(changed.position).toEqual(rig.position)
    expect(changed.ovalRatio).toBe(rig.ovalRatio)
    expect(distanceMeters(rigRadiusHandle(changed), target)).toBeLessThan(0.001)
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
    const target = rigOvalHandle({ ...rig, ovalRatio: 0.4 })
    expect(reshapeRig(rig, target).ovalRatio).toBeCloseTo(0.4)
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

 it.each([1, 10, 50])('numbers %s rig arrows clockwise on the oval and aims each at its center', (arrowCount) => {
  const arrows = rigArrows({ ...rig, arrowCount })
  expect(arrows).toHaveLength(arrowCount)
  for (const [index, arrow] of arrows.entries()) {
    expect(arrow.number).toBe(index + 1)
    const distance = distanceMeters(arrow.position, rig.position)
    expect(distance).toBeGreaterThanOrEqual(rig.radiusMeters * rig.ovalRatio - 0.001)
    expect(distance).toBeLessThanOrEqual(rig.radiusMeters + 0.001)
    expect(distanceMeters(destination(arrow.position, distance, arrow.directionDegrees), rig.position)).toBeLessThan(0.001)
  }
  expect(distanceMeters(arrows[0].position, rigOutline(rig)[0])).toBeLessThan(0.001)
})

it.each([1, 2, 10, 17, 50])('keeps the radius handle outside numbered points with %s arrows through repeated drags', (arrowCount) => {
  for (const ovalRatio of [0.1, 0.5, 1]) {
    const current = { ...rig, arrowCount, ovalRatio }
    const handle = rigRadiusHandle(current)
    for (const arrow of rigArrows(current)) expect(distanceMeters(handle, arrow.position)).toBeGreaterThan(0.01)
    const unchanged = scaleAndRotateRig(current, handle)
    expect(unchanged.radiusMeters).toBeCloseTo(current.radiusMeters, 5)
    expect(unchanged.rotationDegrees).toBeCloseTo(current.rotationDegrees, 5)
    const target = destination(current.position, 140, 355)
    const changed = scaleAndRotateRig(current, target)
    const repeated = scaleAndRotateRig(changed, target)
    expect(distanceMeters(rigRadiusHandle(repeated), target)).toBeLessThan(0.001)
    expect(repeated.radiusMeters).toBeCloseTo(changed.radiusMeters, 5)
    expect(repeated.rotationDegrees).toBeCloseTo(changed.rotationDegrees, 5)
  }
})

it('keeps both rig handles outside numbered points for every supported arrow count', () => {
  for (let arrowCount = 1; arrowCount <= 50; arrowCount++) {
    for (const ovalRatio of [0.1, 0.5, 1]) {
      const current = { ...rig, arrowCount, ovalRatio }
      const arrows = rigArrows(current)
      const radiusHandle = rigRadiusHandle(current)
      const ovalHandle = rigOvalHandle(current)
      expect(bearingDegrees(current.position, radiusHandle)).toBeCloseTo(current.rotationDegrees, 5)
      expect(bearingDegrees(current.position, ovalHandle)).toBeCloseTo(current.rotationDegrees + 90, 5)
      expect(distanceMeters(current.position, radiusHandle)).toBeGreaterThan(current.radiusMeters)
      expect(distanceMeters(current.position, ovalHandle)).toBeGreaterThan(current.radiusMeters * ovalRatio)
      for (const arrow of arrows) {
        expect(distanceMeters(radiusHandle, arrow.position)).toBeGreaterThan(0.01)
        expect(distanceMeters(ovalHandle, arrow.position)).toBeGreaterThan(0.01)
      }
      expect(distanceMeters(radiusHandle, ovalHandle)).toBeGreaterThan(0.01)
      expect(reshapeRig(current, ovalHandle).ovalRatio).toBeCloseTo(ovalRatio, 5)
    }
  }
})

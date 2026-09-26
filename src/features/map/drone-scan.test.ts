import { expect, it } from 'vitest'
import { destination, distanceMeters } from './geometry'
import {
  addDroneScanCircle, applyScanDiameter, centerScanCircles, moveScanCircles, minScanGapMeters, moveScanCircle, placeScanCircle, scaleScanCircle,
} from './drone-scan'
import type { ScanCircle } from '@/features/briefs/model/brief'

const center = { lat: 59.91, lng: 10.75 }
const low: ScanCircle = { id: 'low', position: center, radiusMeters: 100 }
const high: ScanCircle = { id: 'high', position: center, radiusMeters: 40 }

it('keeps the high-res circle inside the low-res circle by the grab gap', () => {
  const outside = destination(center, 200, 20)
  const moved = moveScanCircle(high, outside, 'high', low, minScanGapMeters)
  expect(distanceMeters(low.position, moved.position) + moved.radiusMeters + minScanGapMeters).toBeLessThanOrEqual(low.radiusMeters + 0.05)
})

it('does not let the low-res circle shrink inside the high-res circle', () => {
  const scaled = scaleScanCircle(low, destination(center, 10, 90), 'low', high, minScanGapMeters)
  expect(scaled.radiusMeters).toBeGreaterThanOrEqual(high.radiusMeters + minScanGapMeters - 0.05)
})

it('stops the high-res radius at the low-res outline minus the gap', () => {
  const scaled = scaleScanCircle(high, destination(center, 500, 90), 'high', low, minScanGapMeters)
  expect(scaled.radiusMeters).toBeLessThanOrEqual(low.radiusMeters - minScanGapMeters + 0.05)
  expect(scaled.radiusMeters).toBeGreaterThan(40)
})

it('clamps a typed diameter to the same 2 m floor', () => {
  const grown = applyScanDiameter(high, 400, 'high', low)
  expect(grown.radiusMeters * 2).toBeLessThanOrEqual((low.radiusMeters - minScanGapMeters) * 2 + 0.05)
  const shrunk = applyScanDiameter(low, 10, 'low', high)
  expect(shrunk.radiusMeters).toBeGreaterThanOrEqual(high.radiusMeters + minScanGapMeters - 0.05)
})

it('snaps a dragged diameter to 5 m and keeps the snap inside the other circle', () => {
  const alone = scaleScanCircle(high, destination(center, 23, 90), 'high', null, minScanGapMeters)
  expect(alone.radiusMeters * 2).toBe(45)
  const grown = scaleScanCircle(high, destination(center, 500, 90), 'high', low, minScanGapMeters)
  expect(grown.radiusMeters * 2 % 5).toBe(0)
  expect(grown.radiusMeters).toBeLessThanOrEqual(low.radiusMeters - minScanGapMeters + 0.05)
  const shrunk = scaleScanCircle(low, destination(center, 10, 90), 'low', high, minScanGapMeters)
  expect(shrunk.radiusMeters * 2 % 5).toBe(0)
  expect(shrunk.radiusMeters).toBeGreaterThanOrEqual(high.radiusMeters + minScanGapMeters - 0.05)
})

it('places the second circle concentric and clearly separated', () => {
  const placement = { position: { lat: 60, lng: 11 }, radiusMeters: 40 }
  const outer = placeScanCircle('low', placement, high)
  expect(outer.position).toEqual(high.position)
  expect(outer.radiusMeters).toBeGreaterThanOrEqual(high.radiusMeters * 1.5)
  const inner = placeScanCircle('high', placement, low)
  expect(inner.position).toEqual(low.position)
  expect(inner.radiusMeters).toBeLessThanOrEqual(low.radiusMeters - minScanGapMeters)
  const scan = addDroneScanCircle(null, 'high', placement, { scanId: 'scan', circleId: 'circle' })
  expect(scan.highRes?.id).toBe('circle')
  expect(scan.lowRes).toBeNull()
})

it.each(['high', 'low'] as const)('moves both locked circles from the %s outline without changing their radii or offset', (role) => {
  const scan = { id: 'scan', highRes: { ...high, position: destination(center, 20, 45) }, lowRes: low }
  const next = moveScanCircles(scan, role, { lat: 60, lng: 179.9999 }, true, minScanGapMeters)
  expect((role === 'high' ? next.highRes : next.lowRes)?.position).toEqual({ lat: 60, lng: 179.9999 })
  expect(distanceMeters(next.highRes!.position, next.lowRes!.position)).toBeCloseTo(20, 5)
  expect(next.highRes!.radiusMeters).toBe(high.radiusMeters)
  expect(next.lowRes!.radiusMeters).toBe(low.radiusMeters)
  expect(scan.lowRes).toBe(low)
  expect(scan.highRes.position).not.toEqual(next.highRes!.position)
})

it('keeps unlocked movement constrained and leaves the partner unchanged', () => {
  const scan = { id: 'scan', highRes: high, lowRes: low }
  const next = moveScanCircles(scan, 'high', destination(center, 200, 90), false, minScanGapMeters)
  expect(next.lowRes).toBe(low)
  expect(distanceMeters(next.highRes!.position, low.position)).toBeCloseTo(58, 5)
})

it('centers high res on low res, preserves diameters, and safely handles a missing circle', () => {
  const scan = { id: 'scan', highRes: { ...high, position: destination(center, 20, 90) }, lowRes: low }
  const next = centerScanCircles(scan)
  expect(next.highRes!.position).toEqual(low.position)
  expect(next.highRes!.radiusMeters).toBe(high.radiusMeters)
  expect(next.lowRes).toBe(low)
  expect(scan.highRes.position).not.toEqual(low.position)
  const partial = { ...scan, lowRes: null }
  expect(centerScanCircles(partial)).toBe(partial)
})

it.each(['high', 'low'] as const)('starts concentric at 500/800 m diameters when %s is added first', (first) => {
  const placement = { position: center, radiusMeters: 9000 }
  const initial = addDroneScanCircle(null, first, placement, { scanId: 'scan', circleId: first })
  const second = first === 'high' ? 'low' : 'high'
  const scan = addDroneScanCircle(initial, second, { position: { lat: 61, lng: 12 }, radiusMeters: 10 }, { scanId: 'scan', circleId: second })
  expect(scan.highRes!.radiusMeters * 2).toBe(500)
  expect(scan.lowRes!.radiusMeters * 2).toBe(800)
  expect(scan.highRes!.position).toEqual(center)
  expect(scan.lowRes!.position).toEqual(center)
})

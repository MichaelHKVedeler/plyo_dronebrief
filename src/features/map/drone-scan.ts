import type { DroneBrief, Position, ScanCircle } from '@/features/briefs/model/brief'
import { bearingDegrees, clamp, destination, distanceMeters, metersPerPixel, type CircleRig } from './geometry'

export const minScanRadius = 0.1
export const maxScanRadius = 10000
export const minScanGapMeters = 2
export const scanGrabPixels = 16
export const scanDiameterStep = 5
export const scanOutlineHitRadius = 24
export const scanHandleHitSize = 48
export const defaultScanDiameters = { high: 500, low: 800 } as const
export const droneScanFillOpacity = 0.18
export const droneScanColors = { high: '#2563eb', low: '#dc2626' } as const
export type ScanRole = 'high' | 'low'

export function droneScanColor(role: ScanRole) {
  return role === 'high' ? droneScanColors.high : droneScanColors.low
}

type Scan = NonNullable<DroneBrief['droneScan']>

export function circleOutline(circle: Pick<ScanCircle, 'position' | 'radiusMeters'>, segments = 64): Position[] {
  return Array.from({ length: segments }, (_, index) => destination(circle.position, circle.radiusMeters, (index / segments) * 360))
}

export function droneScanOutlinePoints(scan: Scan): Position[] {
  return [scan.lowRes, scan.highRes].flatMap((circle) => circle ? circleOutline(circle) : [])
}

export function hasDroneScan(scan: DroneBrief['droneScan']): scan is Scan {
  return !!(scan?.highRes || scan?.lowRes)
}

export function formatScanDiameter(radiusMeters: number) {
  const diameter = Math.round(radiusMeters * 2 * 10) / 10
  return Number.isInteger(diameter) ? String(diameter) : diameter.toFixed(1)
}

export function snapScanDiameter(diameterMeters: number, bias: 'nearest' | 'down' | 'up' = 'nearest') {
  const steps = diameterMeters / scanDiameterStep
  const snapped = bias === 'down' ? Math.floor(steps + 1e-9) : bias === 'up' ? Math.ceil(steps - 1e-9) : Math.round(steps)
  return Math.max(scanDiameterStep, snapped * scanDiameterStep)
}

function snapRadiusWithin(radiusMeters: number, minRadius: number, maxRadius: number) {
  let snapped = snapScanDiameter(radiusMeters * 2) / 2
  if (snapped > maxRadius) snapped = snapScanDiameter(maxRadius * 2, 'down') / 2
  if (snapped < minRadius) snapped = snapScanDiameter(minRadius * 2, 'up') / 2
  if (snapped < minRadius - 1e-6 || snapped > maxRadius + 1e-6) return clamp(radiusMeters, minRadius, maxRadius)
  return clamp(snapped, minScanRadius, maxScanRadius)
}

export function scanGapMeters(latitude: number, zoom: number) {
  return Math.max(minScanGapMeters, scanGrabPixels * metersPerPixel(latitude, zoom))
}

export function scanAsRig(circle: ScanCircle): CircleRig {
  return { ...circle, arrowCount: 1, ovalRatio: 1, rotationDegrees: 0 }
}

export function diameterBand(circle: Pick<ScanCircle, 'position' | 'radiusMeters'>, halfWidthMeters: number): Position[] {
  const east = destination(circle.position, circle.radiusMeters, 90)
  const west = destination(circle.position, circle.radiusMeters, 270)
  return [
    destination(west, halfWidthMeters, 0),
    destination(east, halfWidthMeters, 0),
    destination(east, halfWidthMeters, 180),
    destination(west, halfWidthMeters, 180),
  ]
}

export function clampCenterInside(center: Position, radius: number, container: ScanCircle, gap: number): Position {
  const limit = container.radiusMeters - radius - gap
  if (limit <= 0) return container.position
  const distance = distanceMeters(container.position, center)
  if (distance <= limit) return center
  return destination(container.position, limit, bearingDegrees(container.position, center))
}

export function clampCenterAround(center: Position, radius: number, inner: ScanCircle, gap: number) {
  const nextRadius = clamp(Math.max(radius, inner.radiusMeters + gap), minScanRadius, maxScanRadius)
  const limit = nextRadius - inner.radiusMeters - gap
  const distance = distanceMeters(inner.position, center)
  if (limit <= 0 || distance <= limit) return { position: center, radiusMeters: nextRadius }
  return { position: destination(inner.position, limit, bearingDegrees(inner.position, center)), radiusMeters: nextRadius }
}

export function moveScanCircle(circle: ScanCircle, position: Position, role: ScanRole, other: ScanCircle | null, gap: number): ScanCircle {
  if (!other) return { ...circle, position }
  if (role === 'high') return { ...circle, position: clampCenterInside(position, circle.radiusMeters, other, gap) }
  return { ...circle, ...clampCenterAround(position, circle.radiusMeters, other, gap) }
}

export function scaleScanCircle(circle: ScanCircle, point: Position, role: ScanRole, other: ScanCircle | null, gap: number): ScanCircle {
  let minRadius = minScanRadius
  let maxRadius = maxScanRadius
  if (other) {
    const distance = distanceMeters(circle.position, other.position)
    if (role === 'high') maxRadius = Math.max(minScanRadius, other.radiusMeters - distance - gap)
    else minRadius = Math.min(maxScanRadius, distance + other.radiusMeters + gap)
  }
  const radius = clamp(distanceMeters(circle.position, point), minRadius, maxRadius)
  return { ...circle, radiusMeters: snapRadiusWithin(radius, minRadius, maxRadius) }
}

export function applyScanDiameter(circle: ScanCircle, diameterMeters: number, role: ScanRole, other: ScanCircle | null, gap = minScanGapMeters): ScanCircle {
  let radius = clamp(diameterMeters / 2, minScanRadius, maxScanRadius)
  if (!other) return { ...circle, radiusMeters: radius }
  const distance = distanceMeters(circle.position, other.position)
  if (role === 'high') {
    radius = Math.min(radius, Math.max(minScanRadius, other.radiusMeters - distance - gap))
    return { ...circle, radiusMeters: clamp(radius, minScanRadius, maxScanRadius), position: clampCenterInside(circle.position, radius, other, gap) }
  }
  return { ...circle, radiusMeters: clamp(Math.max(radius, distance + other.radiusMeters + gap), minScanRadius, maxScanRadius) }
}

export function scanDiameterBounds(circle: ScanCircle, role: ScanRole, other: ScanCircle | null, gap = minScanGapMeters) {
  if (!other) return { min: 1, max: maxScanRadius * 2 }
  const distance = distanceMeters(circle.position, other.position)
  if (role === 'high') {
    const max = Math.floor(Math.max(minScanRadius, other.radiusMeters - distance - gap) * 2)
    return { min: 1, max: Math.max(1, Math.min(maxScanRadius * 2, max)) }
  }
  const min = Math.ceil((distance + other.radiusMeters + gap) * 2)
  return { min: Math.max(1, Math.min(maxScanRadius * 2, min)), max: maxScanRadius * 2 }
}

/** Fixed initial diameters; the second circle shares the first circle's center. */
export function placeScanCircle(role: ScanRole, placement: { position: Position; radiusMeters: number }, other: ScanCircle | null): Omit<ScanCircle, 'id'> {
  const base = defaultScanDiameters[role] / 2
  if (!other) return { position: placement.position, radiusMeters: snapRadiusWithin(base, minScanRadius, maxScanRadius) }
  if (role === 'low') {
    const radius = Math.min(maxScanRadius, Math.max(base, other.radiusMeters + minScanGapMeters))
    return { position: { ...other.position }, radiusMeters: snapRadiusWithin(radius, radius, maxScanRadius) }
  }
  const inset = base
  const maxFit = other.radiusMeters - minScanGapMeters
  const radius = maxFit >= minScanRadius ? Math.min(Math.max(minScanRadius, inset), maxFit) : Math.max(minScanRadius, other.radiusMeters / 2)
  return { position: { ...other.position }, radiusMeters: snapRadiusWithin(radius, minScanRadius, Math.max(radius, maxFit)) }
}

export function addDroneScanCircle(scan: DroneBrief['droneScan'], role: ScanRole, placement: { position: Position; radiusMeters: number }, ids: { scanId: string; circleId: string }): Scan {
  const other = role === 'high' ? scan?.lowRes ?? null : scan?.highRes ?? null
  const circle: ScanCircle = { ...placeScanCircle(role, placement, other), id: ids.circleId }
  return {
    id: scan?.id ?? ids.scanId,
    highRes: role === 'high' ? circle : scan?.highRes ?? null,
    lowRes: role === 'low' ? circle : scan?.lowRes ?? null,
  }
}

export function withoutScanCircle(brief: DroneBrief, role: ScanRole): DroneBrief {
  const scan = brief.droneScan
  if (!scan) return brief
  const next = { ...scan, highRes: role === 'high' ? null : scan.highRes, lowRes: role === 'low' ? null : scan.lowRes }
  return { ...brief, droneScan: next.highRes || next.lowRes ? next : null }
}

/** Preserve the partner's distance and bearing from the dragged circle. */
export function moveScanCircles(scan: Scan, role: ScanRole, position: Position, locked: boolean, gap: number): Scan {
  const source = role === 'high' ? scan.highRes : scan.lowRes
  const partner = role === 'high' ? scan.lowRes : scan.highRes
  if (!source) return scan
  const moved = locked ? { ...source, position } : moveScanCircle(source, position, role, partner, gap)
  const other = locked && partner ? { ...partner, position: destination(position, distanceMeters(source.position, partner.position), bearingDegrees(source.position, partner.position)) } : partner
  return { ...scan, highRes: role === 'high' ? moved : other, lowRes: role === 'low' ? moved : other }
}

export function centerScanCircles(scan: Scan): Scan {
  if (!scan.highRes || !scan.lowRes) return scan
  return { ...scan, highRes: { ...scan.highRes, position: { ...scan.lowRes.position } } }
}

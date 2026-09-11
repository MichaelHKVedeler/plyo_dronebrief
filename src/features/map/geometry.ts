import type { DroneBrief, Position } from '@/features/briefs/model/brief'

export type CircleRig = NonNullable<DroneBrief['circleRig']>
const EARTH_RADIUS = 6371008.8
const radians = (degrees: number) => degrees * Math.PI / 180
const degrees = (angle: number) => angle * 180 / Math.PI
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export const normalizeHeading = (value: number) => ((value % 360) + 360) % 360

export function distanceMeters(a: Position, b: Position): number {
  const dLat = radians(b.lat - a.lat)
  const dLng = radians(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(clamp(h, 0, 1)))
}

export function bearingDegrees(a: Position, b: Position): number {
  const dLng = radians(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(radians(b.lat))
  const x = Math.cos(radians(a.lat)) * Math.sin(radians(b.lat)) - Math.sin(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.cos(dLng)
  return normalizeHeading(degrees(Math.atan2(y, x)))
}

export function destination(origin: Position, meters: number, heading: number): Position {
  const distance = meters / EARTH_RADIUS
  const bearing = radians(heading)
  const lat = radians(origin.lat)
  const lng = radians(origin.lng)
  const nextLat = Math.asin(clamp(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing), -1, 1))
  const nextLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat))
  return { lat: degrees(nextLat), lng: ((degrees(nextLng) + 540) % 360) - 180 }
}

export function localOffset(origin: Position, point: Position) {
  const distance = distanceMeters(origin, point)
  const bearing = radians(bearingDegrees(origin, point))
  return { east: Math.sin(bearing) * distance, north: Math.cos(bearing) * distance }
}

export function rigOutline(rig: CircleRig): Position[] {
  return Array.from({ length: 64 }, (_, index) => {
    const angle = index / 64 * 2 * Math.PI
    const east = Math.sin(angle) * rig.radiusMeters * rig.ovalRatio
    const north = Math.cos(angle) * rig.radiusMeters
    return destination(rig.position, Math.hypot(east, north), rig.rotationDegrees + degrees(Math.atan2(east, north)))
  })
}

export function pathCenter(points: Position[]): Position {
  let x = 0, y = 0, z = 0
  for (const point of points) {
    x += Math.cos(radians(point.lat)) * Math.cos(radians(point.lng))
    y += Math.cos(radians(point.lat)) * Math.sin(radians(point.lng))
    z += Math.sin(radians(point.lat))
  }
  return { lat: degrees(Math.atan2(z, Math.hypot(x, y))), lng: degrees(Math.atan2(y, x)) }
}

export function resizeRig(rig: CircleRig, point: Position): CircleRig {
  return { ...rig, radiusMeters: clamp(distanceMeters(rig.position, point), 0.1, 10000) }
}

export function rotateRig(rig: CircleRig, point: Position): CircleRig {
  return distanceMeters(rig.position, point) < 0.01 ? rig : { ...rig, rotationDegrees: bearingDegrees(rig.position, point) }
}

// A single major-axis edge point controls both radius and heading.
export function scaleAndRotateRig(rig: CircleRig, point: Position): CircleRig {
  return rotateRig(resizeRig(rig, point), point)
}

// The oval handle sits halfway along the minor axis, inside the rig.
export function reshapeRig(rig: CircleRig, point: Position): CircleRig {
  const { east, north } = localOffset(rig.position, point)
  const rotation = radians(rig.rotationDegrees)
  const minorDistance = east * Math.cos(rotation) - north * Math.sin(rotation)
  return { ...rig, ovalRatio: clamp(Math.abs(minorDistance) * 2 / rig.radiusMeters, 0.1, 1) }
}

export function metersPerPixel(latitude: number, zoom: number): number {
  return 156543.03392 * Math.max(0.001, Math.cos(radians(latitude))) / 2 ** zoom
}

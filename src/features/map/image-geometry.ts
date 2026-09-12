import type { ImageOverlay, Position } from '@/features/briefs/model/brief'
import { clamp, normalizeHeading } from './geometry'

export type ImagePoint = { x: number; y: number }
const R = 6378137
const radians = Math.PI / 180
const circumference = 2 * Math.PI * R
export function imageWorld(point: Position): ImagePoint {
  return { x: point.lng * radians * R, y: -R * Math.log(Math.tan(Math.PI / 4 + clamp(point.lat, -85, 85) * radians / 2)) }
}
export function imagePosition(point: ImagePoint): Position {
  return { lat: (2 * Math.atan(Math.exp(-point.y / R)) - Math.PI / 2) / radians, lng: ((point.x / R / radians + 180) % 360 + 360) % 360 - 180 }
}
function near(point: ImagePoint, origin: ImagePoint): ImagePoint {
  return { x: origin.x + ((point.x - origin.x + circumference * 1.5) % circumference) - circumference / 2, y: point.y }
}
export function imageCorners(overlay: ImageOverlay): Position[] {
  const center = imageWorld(overlay.position)
  const scale = 1 / Math.cos(overlay.position.lat * radians)
  const rotation = overlay.rotationDegrees * radians
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const dx = x * overlay.widthMeters * scale / 2, dy = y * overlay.heightMeters * scale / 2
    return imagePosition({ x: center.x + dx * Math.cos(rotation) - dy * Math.sin(rotation), y: center.y + dx * Math.sin(rotation) + dy * Math.cos(rotation) })
  })
}
export function moveImage(image: ImageOverlay, start: Position, end: Position): ImageOverlay {
  const a = imageWorld(start), b = near(imageWorld(end), a), center = imageWorld(image.position)
  return { ...image, position: imagePosition({ x: center.x + b.x - a.x, y: center.y + b.y - a.y }) }
}
export function transformImage(image: ImageOverlay, anchor: Position, start: Position, end: Position): ImageOverlay {
  const pivot = imageWorld(anchor), a = near(imageWorld(start), pivot), b = near(imageWorld(end), pivot)
  const ax = a.x - pivot.x, ay = a.y - pivot.y, bx = b.x - pivot.x, by = b.y - pivot.y
  const distance = Math.hypot(ax, ay)
  if (distance < 0.01 || Math.hypot(bx, by) < 0.01) return image
  const scale = Math.hypot(bx, by) / distance
  const angle = Math.atan2(by, bx) - Math.atan2(ay, ax)
  const center = near(imageWorld(image.position), pivot), dx = center.x - pivot.x, dy = center.y - pivot.y
  const position = imagePosition({ x: pivot.x + scale * (dx * Math.cos(angle) - dy * Math.sin(angle)), y: pivot.y + scale * (dx * Math.sin(angle) + dy * Math.cos(angle)) })
  const factor = scale * Math.cos(position.lat * radians) / Math.cos(image.position.lat * radians)
  const widthMeters = image.widthMeters * factor, heightMeters = image.heightMeters * factor
  // Reject a step beyond the contract rather than moving the anchor while clamping.
  if (Math.max(widthMeters, heightMeters) > 10000 || Math.min(widthMeters, heightMeters) < 0.1 || Math.abs(position.lat) > 85) return image
  return { ...image, position, widthMeters, heightMeters, rotationDegrees: normalizeHeading(image.rotationDegrees + angle / radians) }
}
export function hitImage(corners: ImagePoint[], point: ImagePoint): 'edge' | 'inside' | null {
  let inside = false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[j], b = corners[i], dx = b.x - a.x, dy = b.y - a.y
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    if (Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= 7) return 'edge'
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside ? 'inside' : null
}

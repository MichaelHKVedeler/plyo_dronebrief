import type { ImageMask } from './brief'

export function maskClipPath(mask?: ImageMask) {
  return mask ? `polygon(${mask.map(({ x, y }) => `${x * 100}% ${y * 100}%`).join(', ')})` : undefined
}

// Clamp the shared delta, not each endpoint, to preserve a dragged segment's length.
export function moveMaskPoints(mask: ImageMask, indices: number[], dx: number, dy: number): ImageMask {
  const points = indices.map((index) => mask[index])
  dx = Math.max(-Math.min(...points.map((p) => p.x)), Math.min(dx, 1 - Math.max(...points.map((p) => p.x))))
  dy = Math.max(-Math.min(...points.map((p) => p.y)), Math.min(dy, 1 - Math.max(...points.map((p) => p.y))))
  return mask.map((point, index) => indices.includes(index) ? { x: point.x + dx, y: point.y + dy } : point)
}

export function pointOnSegment(point: ImageMask[number], a: ImageMask[number], b: ImageMask[number]) {
  const dx = b.x - a.x; const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0
  return { x: a.x + t * dx, y: a.y + t * dy }
}

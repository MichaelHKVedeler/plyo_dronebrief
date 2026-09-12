import { expect, it } from 'vitest'
import type { ImageOverlay } from '@/features/briefs/model/brief'
import { hitImage, imageCorners, imagePosition, imageWorld, moveImage, transformImage } from './image-geometry'
import { scenePoints } from './scene-bounds'
import { createBrief } from '@/features/briefs/model/brief'

export const image: ImageOverlay = { id: 'image', name: 'Plan', source: 'data:image/png;base64,AAAA', position: { lat: 59.91, lng: 10.75 }, widthMeters: 80, heightMeters: 40, rotationDegrees: 0, opacity: 0.7 }
it('keeps the grabbed point and a distant anchor fixed during combined scale/rotation', () => {
  const anchor = imageCorners(image)[0], a = imageWorld(anchor), start = imageCorners(image)[2], s = imageWorld(start)
  const end = imagePosition({ x: a.x - 1.5 * (s.y - a.y), y: a.y + 1.5 * (s.x - a.x) })
  const transformed = transformImage(image, anchor, start, end)
  const corners = imageCorners(transformed)
  expect(corners[0].lat).toBeCloseTo(anchor.lat, 9)
  expect(corners[0].lng).toBeCloseTo(anchor.lng, 9)
  expect(corners[2].lat).toBeCloseTo(end.lat, 9)
  expect(corners[2].lng).toBeCloseTo(end.lng, 9)
  expect(transformed.rotationDegrees).toBeCloseTo(90)
  expect(transformed.widthMeters / transformed.heightMeters).toBeCloseTo(2)
  expect(transformed.widthMeters).toBeCloseTo(120, 1)
})
it('moves without changing shape, rotation, or opacity and handles the date line', () => {
  const source = { ...image, position: { lat: 0, lng: 179.9999 } }
  const moved = moveImage(source, source.position, { lat: 0, lng: -179.9999 })
  expect(moved.position.lng).toBeCloseTo(-179.9999, 8)
  expect({ ...moved, position: source.position }).toEqual(source)
  expect(imageCorners(source)).toHaveLength(4)
})
it('ignores degenerate scaling and rejects out-of-range transforms', () => {
  expect(transformImage(image, image.position, image.position, imageCorners(image)[0])).toBe(image)
  expect(transformImage(image, image.position, imageCorners(image)[0], { lat: 0, lng: 0 })).toBe(image)
})
it('distinguishes a rotated edge from its interior and includes images when framing', () => {
  const square = [{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }]
  expect(hitImage(square, { x: 25, y: 25 })).toBe('edge')
  expect(hitImage(square, { x: 50, y: 50 })).toBe('inside')
  expect(hitImage(square, { x: 0, y: 0 })).toBeNull()
  const brief = createBrief({ name: 'Plan', clientName: 'Test', date: '2026-09-13', times: ['09:00'] })
  expect(scenePoints({ ...brief, imageOverlays: [image] })).toEqual(imageCorners(image))
})

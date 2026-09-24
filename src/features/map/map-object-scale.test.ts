import { expect, it } from 'vitest'
import { metersPerPixel } from './geometry'
import { defaultOverlaySize, mapObjectScale, overlayDisplayPercent, overlayRenderingSize } from './map-object-scale'
import { fromShadeView, toShadeView } from './map-view'

it('maps the overlay slider onto rendering units the public link stores', () => {
  expect(overlayDisplayPercent(defaultOverlaySize)).toBe(50)
  expect(overlayRenderingSize(100)).toBe(120)
  expect(mapObjectScale(17, defaultOverlaySize)).toBe(0.6)
  expect(mapObjectScale(17, overlayRenderingSize(100))).toBe(1.2)
})

it('locks symbols to the map scale across fractional zoom, wide views and providers', () => {
  for (const latitude of [0, 59.9139, -70]) {
    const referenceMeters = 40 * metersPerPixel(latitude, 17)
    for (const zoom of [0, 10, 14, 16.25, 17, 19, 21]) {
      const scale = mapObjectScale(zoom)
      expect(40 * scale * metersPerPixel(latitude, zoom)).toBeCloseTo(referenceMeters, 8)
      expect(mapObjectScale(zoom - 1)).toBe(scale / 2)
      for (const sizePercent of [25, 100, 300]) {
        expect(40 * mapObjectScale(zoom, sizePercent) * metersPerPixel(latitude, zoom)).toBeCloseTo(referenceMeters * sizePercent / 100, 8)
      }
      const shade = toShadeView({ center: { lat: latitude, lng: 10 }, zoom })
      expect(mapObjectScale(fromShadeView({ lat: latitude, lng: 10 }, shade.zoom).zoom)).toBe(scale)
    }
  }
})

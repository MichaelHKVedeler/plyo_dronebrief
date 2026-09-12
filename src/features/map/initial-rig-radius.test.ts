import { expect, it } from 'vitest'
import { initialRigRadius } from './initial-rig-radius'
import { metersPerPixel } from './geometry'
import { fromShadeView, toShadeView } from './map-view'

it('fits desktop and narrow views at different latitudes and zoom levels', () => {
  for (const lat of [0, 60, 80]) for (const zoom of [14, 17.5, 20]) {
    const view = { center: { lat, lng: 10 }, zoom }
    for (const [width, height] of [[1000, 700], [360, 300]]) {
      const radius = initialRigRadius(view, width, height)
      const target = Math.min(width, height) * 0.25 * metersPerPixel(lat, zoom)
      expect(radius).toBeGreaterThanOrEqual(target)
      expect(radius - target).toBeLessThan(1)
      const shade = toShadeView(view)
      expect(initialRigRadius(fromShadeView(view.center, shade.zoom), width, height)).toBe(radius)
    }
  }
})

it('uses a safe fallback without dimensions and respects saved radius limits', () => {
  const center = { lat: 60, lng: 10 }
  expect(initialRigRadius({ center, zoom: 17 }, 0, 0)).toBe(50)
  expect(initialRigRadius({ center, zoom: 0 }, 1000, 700)).toBe(10000)
  expect(initialRigRadius({ center, zoom: 30 }, 360, 300)).toBe(1)
})

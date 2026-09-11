import { expect, it } from 'vitest'
import { fromShadeView, toShadeView } from './map-view'

it('preserves exact WGS84 coordinates and fractional zoom on a round trip', () => {
  for (const zoom of [0, 10, 17.375, 24]) {
    const google = { center: { lat: 59.90717012345678, lng: 10.75349123456789 }, zoom }
    const shade = toShadeView(google)
    expect(shade.center).toEqual([google.center.lng, google.center.lat])
    expect(512 * 2 ** shade.zoom).toBeCloseTo(256 * 2 ** google.zoom)
    expect(fromShadeView({ lng: shade.center[0], lat: shade.center[1] }, shade.zoom)).toEqual(google)
  }
})

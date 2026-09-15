import { expect, it } from 'vitest'
import { fromShadeView, overlayZoomAfterGoogleRestore, toShadeView } from './map-view'

it('preserves exact WGS84 coordinates and fractional zoom on a round trip', () => {
  for (const zoom of [0, 10, 17.375, 24]) {
    const google = { center: { lat: 59.90717012345678, lng: 10.75349123456789 }, zoom }
    const shade = toShadeView(google)
    expect(shade.center).toEqual([google.center.lng, google.center.lat])
    expect(512 * 2 ** shade.zoom).toBeCloseTo(256 * 2 ** google.zoom)
    expect(fromShadeView({ lng: shade.center[0], lat: shade.center[1] }, shade.zoom)).toEqual(google)
  }
})

it('keeps overlay zoom on the shared view until Google\'s restored camera actually moves', () => {
  const first = overlayZoomAfterGoogleRestore(21.69, 20, null)
  expect(first).toEqual({ zoom: 21.69, baseline: 20 })
  expect(overlayZoomAfterGoogleRestore(21.69, 20, first.baseline)).toEqual({ zoom: 21.69, baseline: 20 })
  expect(overlayZoomAfterGoogleRestore(21.69, 21.69, first.baseline)).toEqual({ zoom: 21.69, baseline: null })
})

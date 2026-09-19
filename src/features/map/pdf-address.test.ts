import { expect, it } from 'vitest'
import { nearestStreetAddress } from './pdf-address'

function result(lat: number, components: [string, string][]) {
  return { geometry: { location: { toJSON: () => ({ lat, lng: 10 }) } }, address_components: components.map(([type, long_name]) => ({ types: [type], long_name, short_name: long_name })) } as google.maps.GeocoderResult
}
it('selects the nearest returned street and prefers the neighborhood over the city', () => {
  const far = result(60.01, [['route', 'Far street'], ['locality', 'Oslo']])
  const near = result(60.0001, [['route', 'Nearby street'], ['street_number', '12'], ['neighborhood', 'Bjørvika'], ['locality', 'Oslo']])
  const city = result(60, [['locality', 'Oslo']])
  expect(nearestStreetAddress([far, city, near], { lat: 60, lng: 10 })).toBe('Nearby street 12: Bjørvika')
})
it('does not mistake a locality or plus code for a street address', () => {
  expect(nearestStreetAddress([result(60, [['locality', 'Oslo']])], { lat: 60, lng: 10 })).toBeNull()
  expect(nearestStreetAddress([result(60, [['route', 'A road']])], { lat: 60, lng: 10 })).toBe('A road')
})

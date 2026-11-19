import { expect, it } from 'vitest'
import { latestZoneFile, zonesToGeoJson } from './drone-zones'

const square = [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, 60]]]
const zone = (name: string, projection: unknown) => ({
  type: 'COMMON', identifier: name, name, restriction: 'REQ_AUTHORISATION', reason: ['AIR_TRAFFIC'],
  geometry: [{ uomDimensions: 'M', lowerLimit: 0, upperLimit: 300, horizontalProjection: projection }],
})

it('keeps valid ED-269 polygons with name and restriction, and skips malformed zones', () => {
  const result = zonesToGeoJson([
    zone('Airport', { type: 'Polygon', coordinates: square }),
    zone('Circle', { type: 'Circle', center: [10, 60], radius: 500 }),
    zone('Broken', { type: 'Polygon', coordinates: [[[200, 60]]] }),
    { name: 'No geometry' },
  ])
  expect(result.features).toEqual([{ type: 'Feature', properties: { name: 'Airport', restriction: 'REQ_AUTHORISATION' }, geometry: { type: 'Polygon', coordinates: square } }])
})

it('refuses a file with no usable zones instead of serving an empty map', () => {
  expect(() => zonesToGeoJson([])).toThrow()
  expect(() => zonesToGeoJson({})).toThrow()
})

it('picks the newest dated ED-269 file linked from the page', () => {
  const html = '<a href="Downloads/NOR_ED269_compliant_geozones_2026-10-18.json">old</a><a href="Downloads/NOR_ED318_compliant_geozones_2026-11-18.json"></a><a href="Downloads/NOR_ED269_compliant_geozones_2026-11-18.json">new</a>'
  expect(latestZoneFile(html)).toBe('https://dronesoner.no/Downloads/NOR_ED269_compliant_geozones_2026-11-18.json')
  expect(() => latestZoneFile('<html></html>')).toThrow()
})

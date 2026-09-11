import { expect, it } from 'vitest'
import type { Polygon } from 'geojson'
import { shadowBuildings } from './shadow-buildings'

const geometry: Polygon = { type: 'Polygon', coordinates: [[[10, 59], [10.01, 59], [10, 59.01], [10, 59]]] }
it('preserves geometry exposed by SDK prototype getters and removes tile duplicates', () => {
  class Building {
    id = 1
    properties = { render_height: 24, render_min_height: 4 }
    get geometry() { return geometry }
  }
  const buildings = shadowBuildings([new Building(), new Building()])
  expect(buildings).toEqual([{ type: 'Feature', id: 1, geometry, properties: { height: 24, base_height: 4 } }])
  expect(JSON.parse(JSON.stringify(buildings))[0].geometry).toEqual(geometry)
})
it('ignores underground structures and normalizes missing or invalid heights', () => {
  expect(shadowBuildings([{ geometry, properties: { underground: true } }])).toEqual([])
  expect(shadowBuildings([{ geometry, properties: { height: 'invalid', min_height: -5 } }])[0].properties).toEqual({ height: 3, base_height: 0 })
})

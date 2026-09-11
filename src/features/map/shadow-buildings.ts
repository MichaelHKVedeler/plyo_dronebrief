import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson'

export function shadowBuildings(features: Array<{ geometry: Geometry; properties: Record<string, unknown>; id?: string | number }>): Feature<Polygon | MultiPolygon, { height: number; base_height: number }>[] {
  const seen = new Set<string>()
  return features.flatMap((feature) => {
    const { geometry, properties } = feature
    if (properties.underground === true || properties.underground === 'true' || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return []
    const rawHeight = Number(properties.render_height ?? properties.height)
    const rawBase = Number(properties.render_min_height ?? properties.min_height)
    const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 3
    const base_height = Number.isFinite(rawBase) ? Math.max(0, Math.min(rawBase, height)) : 0
    // Tile buffers can repeat a polygon. Keep distinct clipped pieces of the same ID.
    const key = JSON.stringify([geometry, height, base_height])
    if (seen.has(key)) return []
    seen.add(key)
    // MapLibre geometry is a prototype getter: spreading the SDK feature loses it.
    return [{ type: 'Feature' as const, id: feature.id, geometry, properties: { height, base_height } }]
  }).sort((a, b) => a.properties.height - b.properties.height)
}

import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import type { DroneBrief, LayerVisibility } from '@/features/briefs/model/brief'
import { cameraAppearance } from '@/features/briefs/components/camera-appearance'
import { destination, metersPerPixel, rigOutline } from './geometry'
import { mapBrandColor } from './map-colors'
import { mapObjectScale } from './map-object-scale'

export function shadeScene(brief: DroneBrief, visibility: LayerVisibility, googleZoom: number, dark = false): FeatureCollection {
  const features: Feature<LineString | Polygon>[] = []
  if (visibility.circleRig && brief.circleRig) {
    const ring = rigOutline(brief.circleRig).map((p) => [p.lng, p.lat])
    features.push({ type: 'Feature', properties: { color: mapBrandColor(dark) }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } })
  }
  if (visibility.angles) for (const angle of brief.angles) {
    if (angle.type === '360') continue
    const target = destination(angle.position, metersPerPixel(angle.position.lat, googleZoom) * 64 * mapObjectScale(googleZoom), angle.directionDegrees)
    features.push({ type: 'Feature', properties: { color: cameraAppearance[angle.type].color }, geometry: { type: 'LineString', coordinates: [[angle.position.lng, angle.position.lat], [target.lng, target.lat]] } })
  }
  if (visibility.polygons) for (const polygon of brief.polygons) {
    const ring = polygon.vertices.map((p) => [p.lng, p.lat])
    features.push({ type: 'Feature', properties: { color: '#b45309' }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } })
  }
  return { type: 'FeatureCollection', features }
}

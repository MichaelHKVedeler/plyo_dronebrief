import type { DroneBrief, Position } from '@/features/briefs/model/brief'
import { destination, rigOutline } from './geometry'

export function scenePoints(brief: DroneBrief): Position[] {
  const points = brief.angles.map((angle) => angle.position)
  if (brief.circleRig) points.push(...rigOutline(brief.circleRig))
  for (const polygon of brief.polygons) points.push(...polygon.vertices)
  return points.length ? points : [brief.coordinates]
}

export function sceneBounds(points: Position[]): google.maps.LatLngBoundsLiteral {
  if (!points.length) throw new Error('Scene bounds require a location')
  let south = 90, north = -90
  for (const point of points) { south = Math.min(south, point.lat); north = Math.max(north, point.lat) }
  const longitudes = points.map((point) => ((point.lng + 180) % 360 + 360) % 360 - 180).sort((a, b) => a - b)
  // Exclude the largest empty longitude gap, including scenes crossing the date line.
  let gap = -1, gapIndex = 0
  for (let i = 0; i < longitudes.length; i++) {
    const next = i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360
    if (next - longitudes[i] > gap) { gap = next - longitudes[i]; gapIndex = i }
  }
  let west = longitudes[(gapIndex + 1) % longitudes.length], east = longitudes[gapIndex]
  if (north === south && west === east) {
    const center = { lat: north, lng: west }
    south = Math.min(center.lat, destination(center, 25, 180).lat); north = Math.max(center.lat, destination(center, 25, 0).lat)
    west = destination(center, 25, 270).lng; east = destination(center, 25, 90).lng
  }
  return { north, south, east, west }
}

export function fitScene(map: google.maps.Map, brief: DroneBrief) {
  if (!brief.angles.length && !brief.circleRig && !brief.polygons.length && brief.coordinates.lat === 59.9139 && brief.coordinates.lng === 10.7522) {
    map.moveCamera({ center: brief.coordinates, zoom: 10 }); return
  }
  if (!brief.angles.length && !brief.circleRig && !brief.polygons.length && brief.coordinates.lat === 0 && brief.coordinates.lng === 0) {
    map.moveCamera({ center: brief.coordinates, zoom: 2 }); return
  }
  map.fitBounds(sceneBounds(scenePoints(brief)), mapPadding(map))
}

export function mapPadding(map: google.maps.Map) {
  const { clientWidth: width, clientHeight: height } = map.getDiv()
  return { top: Math.min(145, height * 0.36), bottom: Math.min(110, height * 0.34), left: Math.min(100, width * 0.22), right: Math.min(100, width * 0.22) }
}

import { z } from 'zod'
import type { DroneBrief, Position } from '../../briefs/model/brief.js'

/** Optional library metadata. Not part of the brief. Older project documents omit it. */
export const mapViewSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  zoom: z.number().int().min(1).max(21),
})
export type EditorMapView = z.infer<typeof mapViewSchema>

const EARTH = 6371008.8
const radians = (value: number) => value * Math.PI / 180
const degrees = (value: number) => value * 180 / Math.PI
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const wrap = (lng: number) => ((lng + 180) % 360 + 360) % 360 - 180

function destination(origin: Position, meters: number, heading: number): Position {
  const distance = meters / EARTH
  const bearing = radians(heading)
  const lat = radians(origin.lat)
  const lng = radians(origin.lng)
  const nextLat = Math.asin(clamp(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing), -1, 1))
  const nextLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat))
  return { lat: degrees(nextLat), lng: wrap(degrees(nextLng)) }
}

function scenePoints(brief: DroneBrief): Position[] {
  const points = brief.angles.map((angle) => angle.position)
  if (brief.circleRig) for (const heading of [0, 90, 180, 270]) points.push(destination(brief.circleRig.position, brief.circleRig.radiusMeters, heading))
  for (const polygon of brief.polygons) points.push(...polygon.vertices)
  for (const overlay of brief.imageOverlays) {
    const reach = Math.hypot(overlay.widthMeters, overlay.heightMeters) / 2
    for (const heading of [0, 90, 180, 270]) points.push(destination(overlay.position, reach, heading))
  }
  return points.length ? points : [brief.coordinates]
}

function sceneFrame(points: Position[]) {
  let south = 90, north = -90
  for (const point of points) { south = Math.min(south, point.lat); north = Math.max(north, point.lat) }
  const longitudes = points.map((point) => wrap(point.lng)).sort((a, b) => a - b)
  let gap = -1, gapIndex = 0
  for (let i = 0; i < longitudes.length; i++) {
    const next = i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360
    if (next - longitudes[i] > gap) { gap = next - longitudes[i]; gapIndex = i }
  }
  let west = longitudes[(gapIndex + 1) % longitudes.length], east = longitudes[gapIndex]
  if (north === south && west === east) {
    const center = { lat: north, lng: west }
    south = Math.min(center.lat, destination(center, 25, 180).lat)
    north = Math.max(center.lat, destination(center, 25, 0).lat)
    west = destination(center, 25, 270).lng
    east = destination(center, 25, 90).lng
  }
  return { north, south, east, west }
}

function zoomFor(frame: { north: number; south: number; east: number; west: number }) {
  const size = 400 * 0.8
  const latRad = (lat: number) => Math.log(Math.tan(Math.PI / 4 + clamp(lat, -85, 85) * Math.PI / 360))
  const latFraction = Math.abs(latRad(frame.north) - latRad(frame.south)) / Math.PI
  const span = frame.east >= frame.west ? frame.east - frame.west : frame.east + 360 - frame.west
  const lngFraction = span / 360
  const latZoom = latFraction < 1e-12 ? 21 : Math.log2(size / 256 / latFraction)
  const lngZoom = lngFraction < 1e-12 ? 21 : Math.log2(size / 256 / lngFraction)
  return clamp(Math.floor(Math.min(latZoom, lngZoom)), 1, 21)
}

/** Center and zoom matching the editor's opening frame, including the Oslo and unset-origin defaults. */
export function editorMapView(brief: DroneBrief): EditorMapView {
  const empty = !brief.angles.length && !brief.circleRig && !brief.polygons.length && !brief.imageOverlays.length
  if (empty && brief.coordinates.lat === 59.9139 && brief.coordinates.lng === 10.7522) return { lat: 59.9139, lng: 10.7522, zoom: 10 }
  if (empty && brief.coordinates.lat === 0 && brief.coordinates.lng === 0) return { lat: 0, lng: 0, zoom: 2 }
  const frame = sceneFrame(scenePoints(brief))
  const span = frame.east >= frame.west ? frame.east - frame.west : frame.east + 360 - frame.west
  return mapViewSchema.parse({ lat: clamp((frame.north + frame.south) / 2, -85, 85), lng: wrap(frame.west + span / 2), zoom: zoomFor(frame) })
}

export function staticMapUrl(view: EditorMapView, apiKey: string) {
  const params = new URLSearchParams({
    center: `${view.lat},${view.lng}`, zoom: String(view.zoom), size: '400x400', scale: '2', maptype: 'satellite', key: apiKey,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`
}

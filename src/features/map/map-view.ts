import type { Position } from '@/features/briefs/model/brief'

export type MapView = { center: Position; zoom: number }
// Google uses a 256 px world at zoom 0; MapLibre uses 512 px.
export function toShadeView(view: MapView) {
  return { center: [view.center.lng, view.center.lat] as [number, number], zoom: view.zoom - 1 }
}
export function fromShadeView(center: Position, zoom: number): MapView {
  return { center: { lat: center.lat, lng: center.lng }, zoom: zoom + 1 }
}

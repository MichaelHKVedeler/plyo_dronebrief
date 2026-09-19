import type { Position } from '@/features/briefs/model/brief'

export type MapView = { center: Position; zoom: number }
// Google uses a 256 px world at zoom 0; MapLibre uses 512 px.
export function toShadeView(view: MapView) {
  return { center: [view.center.lng, view.center.lat] as [number, number], zoom: view.zoom - 1 }
}
export function fromShadeView(center: Position, zoom: number): MapView {
  return { center: { lat: center.lat, lng: center.lng }, zoom: zoom + 1 }
}

// After ShadeMap updates the shared view, Google can emit its hidden camera once
// it is shown again. Keep overlay scale on the shared zoom until that camera moves.
export function overlayZoomAfterGoogleRestore(sharedZoom: number, eventZoom: number, baselineZoom: number | null) {
  if (baselineZoom === null) return { zoom: sharedZoom, baseline: eventZoom }
  if (Math.abs(eventZoom - baselineZoom) < 1e-3) return { zoom: sharedZoom, baseline: baselineZoom }
  return { zoom: eventZoom, baseline: null as number | null }
}

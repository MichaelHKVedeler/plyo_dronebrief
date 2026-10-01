import type { Map } from 'maplibre-gl'
import { attachPlacementGesture, type PlacementGestureProps } from './placement-gesture'

export function attachShadePlacement(map: Map, surface: HTMLElement, getLatest: () => PlacementGestureProps) {
  return attachPlacementGesture(surface, (event) => {
    const rect = map.getContainer().getBoundingClientRect()
    const point = map.unproject([event.clientX - rect.left, event.clientY - rect.top])
    return { lat: point.lat, lng: point.lng }
  }, getLatest)
}

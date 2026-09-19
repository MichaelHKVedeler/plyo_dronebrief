import { metersPerPixel } from './geometry'
import type { MapView } from './map-view'

export function initialRigRadius(view: MapView, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 50
  // Diameter fills half the shorter viewport dimension, leaving room for controls.
  return Math.max(1, Math.min(10000, Math.ceil(Math.min(width, height) * 0.25 * metersPerPixel(view.center.lat, view.zoom))))
}

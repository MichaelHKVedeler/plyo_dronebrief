import { flushSync } from 'react-dom'
import type { Map } from 'maplibre-gl'
import { fromShadeView, type MapView } from './map-view'

// Commit DOM overlays before the browser paints the map's newly rendered frame.
// Shadow/tile renders with an unchanged camera need no React update.
export function attachShadeViewSync(map: Map, update: (view: MapView) => void) {
  let previous = ''
  const sync = () => {
    const view = fromShadeView(map.getCenter(), map.getZoom())
    const canvas = map.getCanvas()
    const signature = `${view.center.lat},${view.center.lng},${view.zoom},${canvas.width},${canvas.height}`
    if (signature === previous) return
    previous = signature
    flushSync(() => update(view))
  }
  map.on('render', sync)
  return () => { map.off('render', sync) }
}

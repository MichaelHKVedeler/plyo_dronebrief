import { flushSync } from 'react-dom'
import type { Map } from 'maplibre-gl'
import { fromShadeView, type MapView } from './map-view'

// Zoom/resize must commit overlay scale before the browser paints.
// Pan only stores the new center; HTML overlays reproject themselves.
export function attachShadeViewSync(map: Map, update: (view: MapView) => void) {
  let previous = ''
  let previousLayout = ''
  const sync = () => {
    const view = fromShadeView(map.getCenter(), map.getZoom())
    const canvas = map.getCanvas()
    const layout = `${view.zoom},${canvas.width},${canvas.height}`
    const signature = `${view.center.lat},${view.center.lng},${layout}`
    if (signature === previous) return
    previous = signature
    if (layout === previousLayout) { update(view); return }
    previousLayout = layout
    flushSync(() => update(view))
  }
  map.on('render', sync)
  return () => { map.off('render', sync) }
}

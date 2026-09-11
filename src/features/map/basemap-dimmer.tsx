import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

export function BasemapDimmer() {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const surface = map.getDiv()
    const tint = document.createElement('div')
    tint.dataset.basemapDimmer = ''
    tint.setAttribute('aria-hidden', 'true')
    Object.assign(tint.style, {
      position: 'absolute',
      pointerEvents: 'none',
      background: 'rgba(10, 12, 14, 0.15)',
    })
    class Dimmer extends google.maps.OverlayView {
      onAdd() {
        // Google's lowest overlay pane sits above tiles but below polygons,
        // markers, interactive handles, and attribution.
        this.getPanes()?.mapPane.appendChild(tint)
      }
      draw() {
        if (!tint.isConnected) return
        const center = map!.getCenter()
        const pixel = center && this.getProjection()?.fromLatLngToDivPixel(center)
        if (!pixel) return
        const width = surface.clientWidth, height = surface.clientHeight
        // Overscan avoids exposed edges while the map animates a pan or zoom.
        Object.assign(tint.style, {
          left: `${pixel.x - width * 1.5}px`, top: `${pixel.y - height * 1.5}px`,
          width: `${width * 3}px`, height: `${height * 3}px`,
        })
      }
      onRemove() { tint.remove() }
    }
    const overlay = new Dimmer()
    overlay.setMap(map)
    const resize = new ResizeObserver(() => overlay.draw())
    resize.observe(surface)
    return () => { resize.disconnect(); overlay.setMap(null) }
  }, [map])
  return null
}

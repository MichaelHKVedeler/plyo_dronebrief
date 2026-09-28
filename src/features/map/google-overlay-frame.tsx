import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useMap } from '@vis.gl/react-google-maps'

// Camera events can announce the next zoom before Google's overlay projection
// changes. Use the same draw cycle as the floorplan, so icons never jump ahead.
export function GoogleOverlayFrame({ initialZoom, children }: { initialZoom: number; children: (zoom: number) => ReactNode }) {
  const map = useMap()
  const [zoom, setZoom] = useState(initialZoom)
  useEffect(() => {
    if (!map) return
    let attaching = true
    let previous: number | undefined
    class Frame extends google.maps.OverlayView {
      onAdd() {}
      draw() {
        const width = this.getProjection()?.getWorldWidth()
        if (!width || !Number.isFinite(width)) return
        const next = Math.log2(width / 256)
        if (next === previous) return
        previous = next
        // setMap may draw immediately inside this effect. Later SDK draws must
        // commit before paint, without waiting for a deferred React render.
        if (attaching) setZoom(next)
        else flushSync(() => setZoom(next))
      }
      onRemove() {}
    }
    const frame = new Frame()
    frame.setMap(map)
    attaching = false
    return () => frame.setMap(null)
  }, [map])
  return children(zoom)
}

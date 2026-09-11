import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

export function MiddleMousePan({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const surface = map.getDiv()
    let last: { x: number; y: number; center: google.maps.Point; scale: number; projection: google.maps.Projection } | null = null
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
    const inside = (event: Event) => event.composedPath().includes(surface)
    const reset = () => {
      if (last) onActiveChange(false)
      last = null
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 1 || !inside(event)) return
      stop(event)
      const projection = map.getProjection()
      const center = map.getCenter()
      const zoom = map.getZoom()
      const point = center && projection?.fromLatLngToPoint(center)
      if (!projection || !point || zoom === undefined) return
      last = { x: event.clientX, y: event.clientY, center: point, scale: 2 ** zoom, projection }
      onActiveChange(true)
    }
    const move = (event: PointerEvent) => {
      if (!last) return
      if (!(event.buttons & 4)) { reset(); return }
      stop(event)
      // Anchor to the initial center so rapid events never lose distance to
      // panBy's animation. World coordinates scale to CSS pixels at this zoom.
      const center = last.projection.fromPointToLatLng(new google.maps.Point(
        last.center.x + (last.x - event.clientX) / last.scale,
        last.center.y + (last.y - event.clientY) / last.scale,
      ))
      if (center) map.moveCamera({ center })
    }
    const up = (event: PointerEvent) => {
      if (!last || event.button !== 1) return
      stop(event)
      reset()
    }
    // Capture before the SDK's marker handlers; also block compatibility mouse
    // events and the browser's middle-click autoscroll/auxiliary action.
    const mouse = (event: MouseEvent) => {
      if (last || (event.button === 1 && inside(event))) stop(event)
    }
    const wheel = (event: WheelEvent) => { if (last) stop(event) }
    const options = { capture: true, passive: false }
    window.addEventListener('pointerdown', down, options)
    window.addEventListener('pointermove', move, options)
    window.addEventListener('pointerup', up, options)
    window.addEventListener('pointercancel', reset, options)
    window.addEventListener('blur', reset)
    window.addEventListener('wheel', wheel, options)
    const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'auxclick'] as const
    mouseEvents.forEach((name) => window.addEventListener(name, mouse, options))
    return () => {
      reset()
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', reset, true)
      window.removeEventListener('blur', reset)
      window.removeEventListener('wheel', wheel, true)
      mouseEvents.forEach((name) => window.removeEventListener(name, mouse, true))
    }
  }, [map, onActiveChange])
  return null
}

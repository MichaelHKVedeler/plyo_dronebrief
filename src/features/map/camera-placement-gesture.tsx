import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { aimPlacement, idleTool, type MapTool } from './placement'
import type { Position } from '@/features/briefs/model/brief'

type Props = { tool: MapTool; onToolChange: (tool: MapTool) => void; onPlace: (tool: MapTool, point: Position) => void }
export function CameraPlacementGesture(props: Props) {
  const map = useMap()
  const latest = useRef(props)
  useLayoutEffect(() => { latest.current = props })
  const type = props.tool.kind === 'camera' ? props.tool.cameraType : null
  useEffect(() => {
    if (!map || !type) return
    const surface = map.getDiv()
    let held: MapTool | null = null
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
    const inside = (event: Event) => event.composedPath().includes(surface)
    function point(event: PointerEvent): Position | null {
      const projection = map!.getProjection()
      const center = map!.getCenter()
      const zoom = map!.getZoom()
      const origin = center && projection?.fromLatLngToPoint(center)
      if (!projection || !origin || zoom === undefined) return null
      const rect = surface.getBoundingClientRect()
      return projection.fromPointToLatLng(new google.maps.Point(
        origin.x + (event.clientX - rect.left - rect.width / 2) / 2 ** zoom,
        origin.y + (event.clientY - rect.top - rect.height / 2) / 2 ** zoom,
      ))?.toJSON() ?? null
    }
    function down(event: PointerEvent) {
      if (!inside(event)) return
      if (event.button === 2) { stop(event); held = null; return }
      if (event.button !== 0 || event.buttons & 4) return
      if (event.target instanceof Element && event.target.closest('button, input, [role="switch"], a')) return
      const position = point(event)
      const tool = latest.current.tool
      if (!position || tool.kind !== 'camera') return
      stop(event)
      held = { ...tool, position, directionDegrees: 0 }
      if (type !== '360') latest.current.onToolChange(held)
    }
    function move(event: PointerEvent) {
      if (!held) return
      stop(event)
      const position = point(event)
      if (position) { held = aimPlacement(held, position); latest.current.onToolChange(held) }
    }
    function up(event: PointerEvent) {
      if (!held || event.button !== 0) return
      stop(event)
      const position = point(event)
      const current = held
      held = null
      if (position && latest.current.tool.kind === 'camera') latest.current.onPlace(current, position)
    }
    function cancel() { held = null; latest.current.onToolChange(idleTool) }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') cancel() }
    function context(event: Event) { if (inside(event)) { stop(event); cancel() } }
    function mouse(event: MouseEvent) { if (held || (inside(event) && event.button === 0 && event.type === 'click')) stop(event) }
    const options = { capture: true, passive: false }
    window.addEventListener('pointerdown', down, options)
    window.addEventListener('pointermove', move, options)
    window.addEventListener('pointerup', up, options)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key, true)
    surface.addEventListener('contextmenu', context, options)
    window.addEventListener('mousedown', mouse, options)
    // Map clicks are ignored for camera placement; suppress compatibility downs during aiming.
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key, true)
      surface.removeEventListener('contextmenu', context, true)
      window.removeEventListener('mousedown', mouse, true)
    }
  }, [map, type])
  return null
}

import { aimPlacement, idleTool, type MapTool } from './placement'
import type { Position } from '@/features/briefs/model/brief'

export type PlacementGestureProps = { tool: MapTool; onToolChange: (tool: MapTool) => void; onPlace: (tool: MapTool, point: Position) => void }

export function attachPlacementGesture(surface: HTMLElement, point: (event: PointerEvent) => Position | null, getLatest: () => PlacementGestureProps) {
  let held: MapTool | null = null
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
  const inside = (event: Event) => event.composedPath().includes(surface)
  function down(event: PointerEvent) {
    if (!inside(event)) return
    if (event.button === 2) { stop(event); cancel(); return }
    if (event.button !== 0 || event.buttons & 4) return
    if (event.target instanceof Element && event.target.closest('button, input, textarea, [role="switch"], [role="slider"], a')) return
    const position = point(event)
    const tool = getLatest().tool
    if (!position || tool.kind !== 'camera') return
    stop(event)
    held = { ...tool, position, directionDegrees: 0 }
    if (tool.cameraType !== '360') getLatest().onToolChange(held)
  }
  function move(event: PointerEvent) {
    if (!held) return
    stop(event)
    const position = point(event)
    if (position) { held = aimPlacement(held, position); getLatest().onToolChange(held) }
  }
  function up(event: PointerEvent) {
    if (!held || event.button !== 0) return
    stop(event)
    const position = point(event)
    const current = held
    held = null
    if (position && getLatest().tool.kind === 'camera') getLatest().onPlace(current, position)
  }
  function cancel() { held = null; getLatest().onToolChange(idleTool) }
  function key(event: KeyboardEvent) { if (event.key === 'Escape') cancel() }
  function context(event: Event) { if (inside(event)) { stop(event); cancel() } }
  function mouse(event: MouseEvent) { if (held) stop(event) }
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
}

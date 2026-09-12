import type { Position } from '@/features/briefs/model/brief'
import { rigOutline, type CircleRig } from './geometry'

type Pixel = { x: number; y: number }
export type RigLineDragProps = {
  rig: CircleRig
  interactive: boolean
  strokeWidth: number
  onStart: () => void
  onPreview: (position: Position) => void
  onCommit: (position: Position) => void
  onCancel: () => void
  onHoverChange?: (hovered: boolean) => void
}
export type RigProjection = { project: (point: Position) => Pixel | null; unproject: (point: Pixel) => Position | null }

function segmentDistance(point: Pixel, a: Pixel, b: Pixel) {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}

// Intercept only presses close to the outline, before either SDK starts panning.
// Project the initial center with the pointer delta so grabbing any edge does not
// snap the center to the cursor. Saved radius, rotation and ovalness stay intact.
export function attachRigLineDrag(surface: HTMLElement, projection: RigProjection, latest: () => RigLineDragProps, acceptTarget: (target: EventTarget | null) => boolean = () => true) {
  let drag: { id: number; x: number; y: number; center: Pixel; started: boolean } | null = null
  let suppressClick = false
  let hovered = false
  const feedback = (next: boolean, dragging = false) => {
    if (next) surface.setAttribute('data-rig-move-cursor', dragging ? 'grabbing' : 'grab')
    else surface.removeAttribute('data-rig-move-cursor')
    if (next !== hovered) { hovered = next; latest().onHoverChange?.(next) }
  }
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
  const inside = (event: Event) => event.composedPath().includes(surface)
  const clear = () => {
    const current = drag
    drag = null
    feedback(false)
    if (current && surface.hasPointerCapture?.(current.id)) surface.releasePointerCapture(current.id)
  }
  const cancel = () => { if (drag) { latest().onCancel(); suppressClick = true; clear() } else feedback(false) }
  const point = (event: PointerEvent) => drag && projection.unproject({ x: drag.center.x + event.clientX - drag.x, y: drag.center.y + event.clientY - drag.y })
  const hit = (event: PointerEvent) => {
    const props = latest()
    if (!inside(event) || !props.interactive || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey || !acceptTarget(event.target)) return false
    if (event.target instanceof Element && event.target.closest('button, input, [role="slider"], [role="switch"], gmp-advanced-marker, [data-shade-object]:not([data-rig-outline])')) return false
    const rect = surface.getBoundingClientRect()
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const path = rigOutline(props.rig).map(projection.project)
    return !path.some((p) => !p) && path.some((p, i) => segmentDistance(pointer, p!, path[(i + 1) % path.length]!) <= Math.max(6, props.strokeWidth / 2))
  }
  const down = (event: PointerEvent) => {
    if (!inside(event)) return
    suppressClick = false
    if (event.button !== 0 || drag || !hit(event)) return
    const props = latest()
    const center = projection.project(props.rig.position)
    if (!center) return
    stop(event)
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, center, started: false }
    feedback(true, true)
    surface.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent) => {
    if (!drag) { feedback(event.buttons === 0 && hit(event)); return }
    if (!drag || event.pointerId !== drag.id) return
    stop(event)
    if (!latest().interactive) { cancel(); return }
    if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return
    const position = point(event)
    if (!position) return
    if (!drag.started) { drag.started = true; latest().onStart() }
    latest().onPreview(position)
  }
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id || event.button !== 0) return
    stop(event)
    const position = point(event)
    if (drag.started && position && latest().interactive) latest().onCommit(position)
    else if (!drag.started && latest().interactive) latest().onStart()
    else latest().onCancel()
    suppressClick = true
    clear()
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag) { stop(event); cancel() } }
  const mouse = (event: MouseEvent) => { if (drag || (suppressClick && inside(event) && (event.type === 'click' || event.type === 'dblclick'))) stop(event) }
  const wheel = (event: WheelEvent) => { if (drag) stop(event) }
  const options = { capture: true, passive: false }
  const leave = () => { if (!drag) feedback(false) }
  surface.addEventListener('pointerleave', leave)
  window.addEventListener('pointerdown', down, options)
  window.addEventListener('pointermove', move, options)
  window.addEventListener('pointerup', up, options)
  window.addEventListener('pointercancel', cancel, options)
  window.addEventListener('keydown', key, options)
  window.addEventListener('blur', cancel)
  window.addEventListener('wheel', wheel, options)
  surface.addEventListener('lostpointercapture', cancel)
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick'] as const
  mouseEvents.forEach((type) => window.addEventListener(type, mouse, options))
  return () => {
    cancel()
    surface.removeEventListener('pointerleave', leave)
    window.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', cancel, true)
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('wheel', wheel, true)
    surface.removeEventListener('lostpointercapture', cancel)
    mouseEvents.forEach((type) => window.removeEventListener(type, mouse, true))
  }
}

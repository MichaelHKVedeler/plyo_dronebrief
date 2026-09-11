import type { Map } from 'maplibre-gl'

// SVG/HTML objects sit above the SDK canvas. Route navigation gestures without
// sending them through the object editing handlers or saving any brief data.
export function attachShadeMapPan(map: Map, surface: HTMLElement) {
  let drag: { id: number; button: number; x: number; y: number; started: boolean; anchor: ReturnType<Map['getCenter']>; offset: [number, number] } | null = null
  let suppressClick = false
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
  const inside = (event: Event) => event.composedPath().includes(surface)
  let frame: number | null = null
  const paint = (finish = false) => {
    if (!drag?.started) return
    // Anchor to the press-time center, not an animation's intermediate center.
    // One ease ID keeps a stream of pointer updates in the same map movement.
    map.panTo(drag.anchor, { offset: drag.offset, duration: finish ? 0 : 80, easing: () => 1, easeId: 'brief-pointer-pan' })
  }
  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    paint(true)
    drag = null
  }
  const down = (event: PointerEvent) => {
    if (!inside(event) || !(event.target instanceof Element)) return
    suppressClick = false
    const target = event.target
    const interior = target.closest('[data-shade-pan-surface]')
    const middle = event.button === 1 && (target === map.getCanvas() || target.closest('[data-shade-object], [data-shade-pan-surface]'))
    if (!middle && !(event.button === 0 && interior)) return
    drag = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, started: false, anchor: map.getCenter(), offset: [0, 0] }
    if (middle) stop(event)
  }
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return
    if (!(event.buttons & (drag.button === 1 ? 4 : 1))) { reset(); return }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (!drag.started && Math.hypot(dx, dy) < 3) return
    stop(event)
    drag.started = true
    suppressClick = true
    drag.offset = [dx, dy]
    if (frame === null) frame = requestAnimationFrame(() => { frame = null; paint() })
  }
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id || event.button !== drag.button) return
    if (drag.started || drag.button === 1) stop(event)
    reset()
  }
  const mouse = (event: MouseEvent) => {
    if ((drag?.started || drag?.button === 1) || (inside(event) && ((event.button === 1) || (suppressClick && ['click', 'dblclick'].includes(event.type))))) stop(event)
  }
  const wheel = (event: WheelEvent) => {
    if (!inside(event)) return
    if (drag) { stop(event); return }
    if (!(event.target instanceof Element) || !event.target.closest('[data-shade-pan-surface], [data-shade-object]')) return
    // Let MapLibre retain its native wheel/trackpad smoothing and zoom anchor.
    // The forwarded event targets the canvas, so it does not enter this branch again.
    stop(event)
    map.getCanvas().dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, composed: true,
      clientX: event.clientX, clientY: event.clientY,
      deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey,
    }))
  }
  const options = { capture: true, passive: false }
  window.addEventListener('wheel', wheel, options)
  window.addEventListener('pointerdown', down, options)
  window.addEventListener('pointermove', move, options)
  window.addEventListener('pointerup', up, options)
  window.addEventListener('pointercancel', reset, options)
  window.addEventListener('blur', reset)
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'auxclick'] as const
  mouseEvents.forEach((name) => window.addEventListener(name, mouse, options))
  return () => {
    reset()
    window.removeEventListener('wheel', wheel, true)
    window.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', reset, true)
    window.removeEventListener('blur', reset)
    mouseEvents.forEach((name) => window.removeEventListener(name, mouse, true))
  }
}

import type { ImageOverlay, Position } from '@/features/briefs/model/brief'
import { hitImage, imageCorners, moveImage, transformImage, type ImagePoint } from './image-geometry'

export type ImageProjection = { project: (point: Position) => ImagePoint | null; unproject: (point: ImagePoint) => Position | null }
export type ImageLayerState = {
  images: ImageOverlay[]; selectedId: string | null; editable: boolean; interactive: boolean
  anchors: Record<string, Position>; sourceUrl: (image: ImageOverlay) => string | undefined
  onSelect: (id: string) => void; onAnchor: (id: string, position: Position) => void
  onCommit: (image: ImageOverlay) => void
}
export function attachImageInteraction(surface: HTMLElement, projection: ImageProjection, getState: () => ImageLayerState, preview: (image: ImageOverlay | null) => void) {
  let drag: { id: number; image: ImageOverlay; start: Position; pixel: ImagePoint; anchor: Position; mode: 'edge' | 'inside'; changed: boolean; latest: ImageOverlay } | null = null
  let suppress = false
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
  const pixel = (event: MouseEvent) => { const rect = surface.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  const onSurface = (event: Event) => event.composedPath().includes(surface)
  const overControl = (event: Event) => event.target instanceof Element && !!event.target.closest('button, input, [role="slider"], a, gmp-advanced-marker, [data-shade-object]')
  const enabled = () => getState().editable && getState().interactive && !surface.closest('[inert]')
  const hit = (point: ImagePoint) => {
    for (const image of [...getState().images].reverse()) {
      if (!getState().sourceUrl(image)) continue
      if (image.opacity === 0 && image.id !== getState().selectedId) continue
      const corners = imageCorners(image).map(projection.project)
      if (corners.some((p) => !p)) continue
      const mode = hitImage(corners as ImagePoint[], point)
      if (mode) return { image, mode }
    }
    return null
  }
  const feedback = (cursor: string) => { if (cursor) surface.setAttribute('data-image-cursor', cursor); else surface.removeAttribute('data-image-cursor') }
  const reset = () => {
    const current = drag
    drag = null; preview(null); feedback('')
    if (current && surface.hasPointerCapture?.(current.id)) surface.releasePointerCapture(current.id)
  }
  const down = (event: PointerEvent) => {
    suppress = false
    if (!enabled() || !onSurface(event) || overControl(event) || event.button !== 0 || event.ctrlKey || event.shiftKey) return
    const point = pixel(event), result = hit(point), start = projection.unproject(point)
    if (!result || !start) return
    stop(event)
    const { image, mode } = result
    drag = { id: event.pointerId, image, start, pixel: point, anchor: getState().anchors[image.id] ?? image.position, mode, changed: false, latest: image }
    suppress = true
    getState().onSelect(image.id)
    surface.setPointerCapture?.(event.pointerId)
    feedback(mode === 'edge' ? 'grabbing' : 'crosshair')
  }
  const move = (event: PointerEvent) => {
    if (!drag) {
      if (enabled() && onSurface(event) && !overControl(event)) {
        const result = hit(pixel(event)); feedback(result?.mode === 'edge' ? 'grab' : result ? 'crosshair' : '')
      } else feedback('')
      return
    }
    if (event.pointerId !== drag.id) return
    if (!enabled() || !getState().images.some((image) => image.id === drag!.image.id) || !(event.buttons & 1)) { reset(); return }
    stop(event)
    const p = pixel(event), end = projection.unproject(p)
    if (!end || (!drag.changed && Math.hypot(p.x - drag.pixel.x, p.y - drag.pixel.y) < 3)) return
    drag.changed = true
    drag.latest = drag.mode === 'edge' ? moveImage(drag.image, drag.start, end) : transformImage(drag.image, drag.anchor, drag.start, end)
    preview(drag.latest)
  }
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id || event.button !== 0) return
    stop(event)
    const current = drag
    reset()
    if (current.changed && enabled() && getState().images.some((image) => image.id === current.image.id)) getState().onCommit(current.latest)
  }
  const context = (event: MouseEvent) => {
    if (!enabled() || !onSurface(event)) return
    // Camera aiming owns right-drag, including a contextmenu on release.
    if (surface.querySelector('[data-camera-aiming]') || (event.target instanceof Element && event.target.closest('[data-camera-aim-control]'))) return
    // Anchors may be placed on icons too; shared app controls remain untouched.
    if (event.target instanceof Element && event.target.closest('input, [role="slider"], a') ) return
    const state = getState(), at = hit(pixel(event))
    const image = state.images.find((item) => item.id === state.selectedId) ?? at?.image ?? state.images.at(-1)
    const point = projection.unproject(pixel(event))
    if (!image || !point) return
    stop(event); reset(); state.onSelect(image.id); state.onAnchor(image.id, point)
  }
  const mouse = (event: MouseEvent) => { if (drag || (suppress && onSurface(event) && ['click', 'dblclick'].includes(event.type))) stop(event) }
  const wheel = (event: WheelEvent) => { if (drag) stop(event) }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag) { stop(event); reset() } }
  const options = { capture: true, passive: false }
  const leave = () => { if (!drag) feedback('') }
  surface.addEventListener('pointerleave', leave)
  surface.addEventListener('lostpointercapture', reset)
  window.addEventListener('pointerdown', down, options)
  window.addEventListener('pointermove', move, options)
  window.addEventListener('pointerup', up, options)
  window.addEventListener('pointercancel', reset, options)
  window.addEventListener('blur', reset)
  window.addEventListener('contextmenu', context, options)
  window.addEventListener('keydown', key, options)
  window.addEventListener('wheel', wheel, options)
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick'] as const
  mouseEvents.forEach((name) => window.addEventListener(name, mouse, options))
  return () => {
    reset()
    surface.removeEventListener('pointerleave', leave); surface.removeEventListener('lostpointercapture', reset)
    window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', reset, true); window.removeEventListener('blur', reset)
    window.removeEventListener('contextmenu', context, true); window.removeEventListener('keydown', key, true); window.removeEventListener('wheel', wheel, true)
    mouseEvents.forEach((name) => window.removeEventListener(name, mouse, true))
  }
}

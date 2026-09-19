import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { normalizeHeading } from './geometry'

export type CameraAim = { directionDegrees: number; distancePixels: number }
function cameraAimAt(x: number, y: number): CameraAim {
  return {
    directionDegrees: normalizeHeading(Math.round(Math.atan2(x, -y) * 180 / Math.PI)),
    distancePixels: Math.hypot(x, y),
  }
}

// Both providers are north-up. The shared gesture reports bearing and distance;
// each camera type decides which of those values belongs in its saved settings.
export function useCameraAimGesture({ enabled, onStart, onPreview, onCommit, onCancel }: {
  enabled: boolean
  onStart: () => void
  onPreview: (aim: CameraAim) => void
  onCommit: (aim: CameraAim) => void
  onCancel: () => void
}) {
  const detach = useRef<(() => void) | null>(null)
  useEffect(() => () => { detach.current?.(); detach.current = null }, [enabled])
  return (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!enabled || event.button !== 2) return false
    event.preventDefault(); event.stopPropagation()
    detach.current?.()
    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const start = { x: event.clientX, y: event.clientY }
    const pointerId = event.pointerId
    let latest: CameraAim | null = null
    let active = true
    const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation() }
    const preview = (e: PointerEvent) => {
      if (!latest && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 3) return
      // At the center there is no bearing; retain the most recent direction.
      const x = e.clientX - center.x, y = e.clientY - center.y
      latest = Math.hypot(x, y) < 1 && latest ? { ...latest, distancePixels: 0 } : cameraAimAt(x, y)
      onPreview(latest)
    }
    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== pointerId) return
      stop(e)
      if (!(e.buttons & 2)) { finish(false); return }
      preview(e)
    }
    const up = (e: PointerEvent) => {
      if (!active || e.pointerId !== pointerId || e.button !== 2) return
      stop(e); preview(e); finish(true)
    }
    const cancel = () => { if (active) finish(false) }
    const key = (e: KeyboardEvent) => { if (active && e.key === 'Escape') { stop(e); cancel() } }
    const context = (e: Event) => {
      // Browsers can emit contextmenu on either press or release, including
      // after pointer capture has ended. Keep swallowing it until next press.
      stop(e)
      if (!active) cleanup()
    }
    const mouse = (e: Event) => { if (active) stop(e) }
    const nextDown = () => { if (!active) cleanup() }
    const options = { capture: true, passive: false }
    const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'auxclick', 'wheel'] as const
    function finish(commit: boolean) {
      active = false
      if (button.hasPointerCapture?.(pointerId)) button.releasePointerCapture(pointerId)
      if (commit && latest) onCommit(latest)
      else onCancel()
    }
    function cleanup() {
      cancel()
      button.removeAttribute('data-camera-aiming')
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('contextmenu', context, true)
      window.removeEventListener('pointerdown', nextDown, true)
      mouseEvents.forEach((name) => window.removeEventListener(name, mouse, true))
      button.removeEventListener('lostpointercapture', cancel)
    }
    window.addEventListener('pointermove', move, options)
    window.addEventListener('pointerup', up, options)
    window.addEventListener('pointercancel', cancel, options)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key, options)
    window.addEventListener('contextmenu', context, options)
    window.addEventListener('pointerdown', nextDown, options)
    mouseEvents.forEach((name) => window.addEventListener(name, mouse, options))
    button.addEventListener('lostpointercapture', cancel)
    button.setAttribute('data-camera-aiming', '')
    button.setPointerCapture?.(pointerId)
    detach.current = cleanup
    onStart()
    return true
  }
}

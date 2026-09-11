import { afterEach, beforeEach, beforeAll, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import type { Map } from 'maplibre-gl'
import { attachShadeMapPan } from './shade-map-pan'

beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent))
beforeEach(() => vi.useFakeTimers())
let detach: (() => void) | undefined
afterEach(() => { detach?.(); vi.useRealTimers(); document.body.replaceChildren() })
function setup() {
  const surface = document.createElement('div')
  surface.innerHTML = '<canvas></canvas><svg><polygon data-shade-pan-surface /></svg><button data-shade-object>Camera</button>'
  document.body.append(surface)
  const canvas = surface.querySelector('canvas')!
  const interior = surface.querySelector('polygon')!
  const marker = surface.querySelector('button')!
  const panTo = vi.fn()
  detach = attachShadeMapPan({ getCanvas: () => canvas, getCenter: () => ({ lat: 60, lng: 10 }), panTo } as unknown as Map, surface)
  return { surface, canvas, interior, marker, panTo }
}
it.each([0, 1])('pans from the rig interior with button %s and suppresses selection after dragging', (button) => {
  const { interior, panTo } = setup()
  const select = vi.fn()
  interior.addEventListener('click', select)
  fireEvent.pointerDown(interior, { button, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(window, { buttons: button === 1 ? 4 : 1, clientX: 120, clientY: 130 })
  fireEvent.pointerMove(window, { buttons: button === 1 ? 4 : 1, clientX: 125, clientY: 140 })
  fireEvent.pointerUp(window, { button })
  fireEvent.click(interior)
  expect(panTo).toHaveBeenCalledExactlyOnceWith({ lat: 60, lng: 10 }, expect.objectContaining({ offset: [25, 40], duration: 0 }))
  expect(select).not.toHaveBeenCalled()
  fireEvent.pointerDown(interior, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerUp(interior, { button: 0 })
  fireEvent.click(interior)
  expect(select).toHaveBeenCalledOnce()
})
it('preserves click selection, normal canvas dragging, and left-button object editing', () => {
  const { interior, canvas, marker, panTo } = setup()
  const select = vi.fn(), edit = vi.fn()
  interior.addEventListener('click', select)
  marker.addEventListener('pointerdown', edit)
  fireEvent.pointerDown(interior, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(window, { buttons: 1, clientX: 11, clientY: 10 })
  fireEvent.pointerUp(interior, { button: 0 })
  fireEvent.click(interior)
  expect(select).toHaveBeenCalledOnce()
  for (const target of [canvas, marker]) {
    fireEvent.pointerDown(target, { button: 0 })
    fireEvent.pointerMove(window, { buttons: 1, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(window, { button: 0 })
  }
  expect(edit).toHaveBeenCalledOnce()
  expect(panTo).not.toHaveBeenCalled()
})
it('middle-drags over cameras and the canvas without triggering edits and stops on cancellation or blur', () => {
  const { canvas, marker, panTo } = setup()
  const edit = vi.fn()
  marker.addEventListener('pointerdown', edit)
  for (const target of [canvas, marker]) {
    fireEvent.pointerDown(target, { button: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { buttons: 4, clientX: 30, clientY: 20 })
    fireEvent.pointerCancel(window)
    fireEvent.pointerMove(window, { buttons: 4, clientX: 40, clientY: 40 })
  }
  expect(panTo).toHaveBeenCalledTimes(2)
  expect(edit).not.toHaveBeenCalled()
  fireEvent.pointerDown(canvas, { button: 1 })
  fireEvent.blur(window)
  fireEvent.pointerMove(window, { buttons: 4, clientX: 40, clientY: 40 })
  expect(panTo).toHaveBeenCalledTimes(2)
})

it('coalesces rapid movement into one frame and keeps a fixed geographic anchor', () => {
  const { interior, panTo } = setup()
  fireEvent.pointerDown(interior, { button: 0, clientX: 100, clientY: 100 })
  for (const x of [110, 120, 130]) fireEvent.pointerMove(window, { buttons: 1, clientX: x, clientY: 110 })
  expect(panTo).not.toHaveBeenCalled()
  vi.advanceTimersByTime(20)
  expect(panTo).toHaveBeenCalledExactlyOnceWith({ lat: 60, lng: 10 }, expect.objectContaining({ offset: [30, 10], duration: 80, easeId: 'brief-pointer-pan' }))
  fireEvent.pointerMove(window, { buttons: 1, clientX: 150, clientY: 120 })
  fireEvent.pointerUp(window, { button: 0 })
  expect(panTo).toHaveBeenLastCalledWith({ lat: 60, lng: 10 }, expect.objectContaining({ offset: [50, 20], duration: 0, easeId: 'brief-pointer-pan' }))
  vi.advanceTimersByTime(100)
  expect(panTo).toHaveBeenCalledTimes(2)
})

it.each(['interior', 'marker'] as const)('forwards wheel zoom over the %s once, preserving the cursor and trackpad deltas', (target) => {
  const scene = setup()
  const zoom = vi.fn()
  scene.canvas.addEventListener('wheel', zoom)
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 120, clientY: 80, deltaX: 1.5, deltaY: -3.5, deltaMode: 0, ctrlKey: true })
  scene[target].dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(zoom).toHaveBeenCalledOnce()
  expect(zoom.mock.calls[0][0]).toMatchObject({ clientX: 120, clientY: 80, deltaX: 1.5, deltaY: -3.5, deltaMode: 0, ctrlKey: true })
  expect(scene.panTo).not.toHaveBeenCalled()
})

it('leaves canvas zoom and other controls alone, and removes wheel forwarding on cleanup', () => {
  const { canvas, surface, interior } = setup()
  const zoom = vi.fn()
  canvas.addEventListener('wheel', zoom)
  fireEvent.wheel(canvas, { deltaY: 100 })
  expect(zoom).toHaveBeenCalledOnce()
  const control = document.createElement('input')
  surface.append(control)
  const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
  control.dispatchEvent(wheel)
  expect(wheel.defaultPrevented).toBe(false)
  expect(zoom).toHaveBeenCalledOnce()
  detach!(); detach = undefined
  fireEvent.wheel(interior, { deltaY: 100 })
  expect(zoom).toHaveBeenCalledOnce()
})

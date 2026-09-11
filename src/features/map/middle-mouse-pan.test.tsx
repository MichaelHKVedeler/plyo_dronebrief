import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MiddleMousePan } from './middle-mouse-pan'

const map = vi.hoisted(() => ({ getDiv: vi.fn(), moveCamera: vi.fn(), getZoom: () => 2, getCenter: () => ({}), getProjection: () => ({ fromLatLngToPoint: () => ({ x: 128, y: 128 }), fromPointToLatLng: (point: { x: number; y: number }) => point }) }))
beforeEach(() => { vi.stubGlobal('google', { maps: { Point: class { x: number; y: number; constructor(x: number, y: number) { this.x = x; this.y = y } } } }) })
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => map }))
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.clearAllMocks(); vi.unstubAllGlobals() })
function pointer(target: EventTarget, type: string, button: number, buttons: number, x = 100, y = 100) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, button, buttons, clientX: x, clientY: y })
  target.dispatchEvent(event)
  return event
}
it.each(['map', 'icon'])('reserves middle dragging over the %s for panning, including outside the map', (target) => {
  const surface = document.createElement('div')
  const icon = document.createElement('button')
  surface.append(icon)
  document.body.append(surface)
  map.getDiv.mockReturnValue(surface)
  const edit = vi.fn()
  surface.addEventListener('pointerdown', edit)
  surface.addEventListener('mousedown', edit)
  render(<MiddleMousePan onActiveChange={vi.fn()} />)
  const origin = target === 'icon' ? icon : surface
  expect(pointer(origin, 'pointerdown', 1, 4).defaultPrevented).toBe(true)
  expect(pointer(origin, 'mousedown', 1, 4).defaultPrevented).toBe(true)
  expect(map.moveCamera).not.toHaveBeenCalled()
  pointer(document.body, 'pointermove', -1, 4, 125, 90)
  expect(map.moveCamera).toHaveBeenCalledExactlyOnceWith({ center: { x: 121.75, y: 130.5 } })
  pointer(document.body, 'pointermove', -1, 4, 150, 80)
  expect(map.moveCamera).toHaveBeenLastCalledWith({ center: { x: 115.5, y: 133 } })
  expect(edit).not.toHaveBeenCalled()
  pointer(document.body, 'pointerup', 1, 0)
  pointer(document.body, 'pointermove', -1, 0, 150, 90)
  expect(map.moveCamera).toHaveBeenCalledTimes(2)
  expect(pointer(origin, 'auxclick', 1, 0).defaultPrevented).toBe(true)
})
it('preserves left-button editing and resets navigation on blur and unmount', () => {
  const surface = document.createElement('div')
  document.body.append(surface)
  map.getDiv.mockReturnValue(surface)
  const edit = vi.fn()
  surface.addEventListener('pointerdown', edit)
  const view = render(<MiddleMousePan onActiveChange={vi.fn()} />)
  pointer(surface, 'pointerdown', 0, 1)
  expect(edit).toHaveBeenCalledTimes(1)
  pointer(surface, 'pointerdown', 1, 4)
  window.dispatchEvent(new Event('blur'))
  pointer(surface, 'pointermove', -1, 4, 200, 200)
  expect(map.moveCamera).not.toHaveBeenCalled()
  view.unmount()
  expect(pointer(surface, 'pointerdown', 1, 4).defaultPrevented).toBe(false)
})



it('disables object interaction and blocks wheel zoom for the entire middle gesture', () => {
  const surface = document.createElement('div')
  document.body.append(surface)
  map.getDiv.mockReturnValue(surface)
  const active = vi.fn()
  render(<MiddleMousePan onActiveChange={active} />)
  pointer(surface, 'pointerdown', 1, 4)
  expect(active).toHaveBeenLastCalledWith(true)
  const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
  surface.dispatchEvent(wheel)
  expect(wheel.defaultPrevented).toBe(true)
  expect(pointer(surface, 'click', 1, 4).defaultPrevented).toBe(true)
  pointer(surface, 'pointerup', 1, 0)
  expect(active).toHaveBeenLastCalledWith(false)
  const normalWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
  surface.dispatchEvent(normalWheel)
  expect(normalWheel.defaultPrevented).toBe(false)
})

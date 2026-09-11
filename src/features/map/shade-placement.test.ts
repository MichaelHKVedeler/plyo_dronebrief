import { afterEach, expect, it, vi } from 'vitest'
import type { Map } from 'maplibre-gl'
import { attachShadePlacement } from './shade-placement'
import { attachShadeMapPan } from './shade-map-pan'
import { idleTool, placeCamera, startCameraPlacement, type MapTool } from './placement'
import type { CameraAngle } from '@/features/briefs/model/brief'

let cleanups: (() => void)[] = []
afterEach(() => { cleanups.forEach((fn) => fn()); cleanups = []; document.body.replaceChildren() })
function setup(type: CameraAngle['type'] = 'dslr') {
  const surface = document.createElement('div')
  surface.innerHTML = '<canvas></canvas><button>Cancel placement</button><input />'
  document.body.append(surface)
  const canvas = surface.querySelector('canvas')!
  const map = { getContainer: () => canvas, getCanvas: () => canvas, getCenter: () => ({ lat: 60, lng: 10 }), unproject: ([x, y]: number[]) => ({ lat: y, lng: x }), panTo: vi.fn(), dragPan: { isEnabled: () => true, disable: vi.fn(), enable: vi.fn() } }
  let tool: MapTool = startCameraPlacement(type)
  const angles: CameraAngle[] = []
  const change = vi.fn((next: MapTool) => { tool = next })
  const place = vi.fn((current: MapTool, point: { lat: number; lng: number }) => {
    const result = placeCamera(current, point, String(angles.length), angles.length + 1)
    tool = result.tool
    if (result.angle) angles.push(result.angle)
  })
  cleanups.push(attachShadeMapPan(map as unknown as Map, surface))
  cleanups.push(attachShadePlacement(map as unknown as Map, surface, () => ({ tool, onToolChange: change, onPlace: place })))
  const send = (type: string, x = 10, y = 60, button = 0, target: EventTarget = canvas) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button, buttons: button === 1 ? 4 : 1, clientX: x, clientY: y })
    target.dispatchEvent(event)
    return event
  }
  return { surface, canvas, map, send, change, place, angles, getTool: () => tool }
}
it.each(['dslr', 'drone-image'] as const)('places and aims repeated %s cameras on release without panning', (type) => {
  const { send, angles, map, getTool } = setup(type)
  send('pointerdown'); send('pointermove', 11, 60)
  expect(angles).toHaveLength(0)
  expect(getTool()).toMatchObject({ position: { lat: 60, lng: 10 } })
  send('pointerup', 11, 60)
  expect(angles[0]).toMatchObject({ type, position: { lat: 60, lng: 10 }, directionDegrees: expect.any(Number) })
  send('pointerdown', 12); send('pointerup', 13)
  expect(angles).toHaveLength(2)
  expect(map.panTo).not.toHaveBeenCalled()
  expect(map.dragPan.disable).toHaveBeenCalledOnce()
  cleanups.pop()!()
  expect(map.dragPan.enable).toHaveBeenCalledOnce()
})
it('places a 360 point with a single click and no direction', () => {
  const { send, angles } = setup('360')
  send('pointerdown'); send('pointerup')
  expect(angles).toEqual([{ id: '0', label: '360 1', type: '360', position: { lat: 60, lng: 10 } }])
})
it.each(['right', 'escape', 'pointercancel', 'blur'])('discards unfinished placement on %s', (method) => {
  const { send, angles, getTool } = setup()
  send('pointerdown'); send('pointermove', 11)
  if (method === 'right') { send('pointerdown', 11, 60, 2); expect(send('contextmenu').defaultPrevented).toBe(true) }
  else if (method === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  else window.dispatchEvent(new Event(method))
  send('pointerup', 11)
  expect(angles).toEqual([])
  expect(getTool()).toEqual(idleTool)
})
it('leaves toolbar controls and middle-button navigation available during placement', () => {
  const { surface, send, angles, place, map } = setup()
  send('pointerdown', 10, 60, 0, surface.querySelector('button')!)
  send('pointerup')
  send('pointerdown', 10, 60, 0, surface.querySelector('input')!)
  send('pointerup')
  send('pointerdown', 10, 60, 1)
  send('pointermove', 20, 70, 1, window)
  send('pointerup', 20, 70, 1, window)
  expect(map.panTo).toHaveBeenCalledWith({ lat: 60, lng: 10 }, expect.objectContaining({ offset: [10, 10], duration: 0 }))
  expect(place).not.toHaveBeenCalled()
  expect(angles).toEqual([])
})

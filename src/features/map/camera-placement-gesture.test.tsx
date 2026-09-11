import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CameraPlacementGesture } from './camera-placement-gesture'
import { startCameraPlacement, idleTool } from './placement'
const map = vi.hoisted(() => ({ getDiv: vi.fn(), getCenter: () => ({}), getZoom: () => 0, getProjection: () => ({ fromLatLngToPoint: () => ({ x: 0, y: 0 }), fromPointToLatLng: (p: { x: number; y: number }) => ({ toJSON: () => ({ lat: p.y, lng: p.x }) }) }) }))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => map }))
beforeEach(() => { vi.stubGlobal('google', { maps: { Point: class { x: number; y: number; constructor(x: number, y: number) { this.x = x; this.y = y } } } }) })
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals() })
function setup() {
 const surface = document.createElement('div'); document.body.append(surface); map.getDiv.mockReturnValue(surface)
 const change = vi.fn(); const place = vi.fn()
 render(<CameraPlacementGesture tool={startCameraPlacement('dslr')} onToolChange={change} onPlace={place} />)
 const send = (type: string, x = 1, button = 0) => surface.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 1, button, buttons: 1 }))
 return { surface, change, place, send }
}
it('places on release, uses the press position, and accepts the next gesture', () => {
 const { place, change, send } = setup()
 send('pointerdown'); send('pointermove', 2)
 expect(place).not.toHaveBeenCalled()
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ position: { lat: 1, lng: 1 } }))
 send('pointerup', 2)
 expect(place).toHaveBeenCalledWith(expect.objectContaining({ position: { lat: 1, lng: 1 } }), { lat: 1, lng: 2 })
 send('pointerdown', 3); send('pointerup', 4)
 expect(place).toHaveBeenCalledTimes(2)
})
it.each(['escape', 'right'])('discards unfinished placement on %s', (method) => {
 const { surface, send, change, place } = setup()
 send('pointerdown')
 if (method === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
 else { send('pointerdown', 1, 2); surface.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) }
 send('pointerup', 2)
 expect(place).not.toHaveBeenCalled()
 expect(change).toHaveBeenLastCalledWith(idleTool)
})

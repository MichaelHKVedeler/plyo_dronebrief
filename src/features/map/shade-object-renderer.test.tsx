import { ShadeProjection } from './shade-projection'
import { useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { Map } from 'maplibre-gl'
import type { CameraAngle } from '@/features/briefs/model/brief'
import { CameraMarker } from './camera-marker'
import { RigObject } from './rig-object'
import { ObjectRenderer } from './object-renderer'
import { ShadeMarker, ShadePolygon } from './shade-object-renderer'
import type { CircleRig } from './geometry'
import { MapObjectScale } from './map-object-scale'

vi.mock('@vis.gl/react-google-maps', async (importOriginal) => ({ ...await importOriginal<typeof import('@vis.gl/react-google-maps')>(), useMap: () => null }))
const projection = { getCanvas: () => document.querySelector('canvas'), getContainer: () => document.body.firstElementChild!, project: ([lng, lat]: number[]) => ({ x: lng, y: lat }), unproject: ([x, y]: number[]) => ({ lng: x, lat: y }) } as unknown as Map
beforeAll(() => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
afterEach(cleanup)
function Surface({ children }: { children: ReactNode }) {
  return <ShadeProjection value={projection}><ObjectRenderer value={{ Marker: ShadeMarker, Polygon: ShadePolygon }}><div>{children}</div></ObjectRenderer></ShadeProjection>
}
const original: CameraAngle = { id: 'camera', label: 'Camera', type: 'dslr', position: { lat: 60, lng: 10 }, directionDegrees: 90 }
it.each([true, false])('scales rig decorations with radius and zoom, independently of overlay size (editable: %s)', (editable) => {
  const rig: CircleRig = { id: 'rig', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 100, ovalRatio: 0.6, rotationDegrees: 0 }
  const commit = vi.fn()
  const scene = (radiusMeters: number, pixelsToMeters: number, overlayScale: number) => <Surface><MapObjectScale value={overlayScale}>
    <RigObject rig={{ ...rig, radiusMeters }} pixelsToMeters={pixelsToMeters} editable={editable} interactive selected onSelect={vi.fn()} onCommit={commit} />
  </MapObjectScale></Surface>
  const view = render(scene(100, 1, 0.25))
  const sizes = () => [
    Number(view.container.querySelector('polygon')!.getAttribute('stroke-width')),
    Number(screen.getByRole('img', { name: 'Rig arrow 1, pointing toward center' }).style.zoom),
    ...(editable ? [Number(screen.getByRole('button', { name: 'Scale and rotate circle rig' }).style.zoom)] : []),
  ]
  const initial = sizes()
  view.rerender(scene(100, 1, 3))
  expect(sizes()).toEqual(initial)
  view.rerender(scene(200, 1, 3))
  expect(sizes()).toEqual(initial.map((size) => size * 2))
  view.rerender(scene(200, 2, 3))
  expect(sizes()).toEqual(initial)
  expect(commit).not.toHaveBeenCalled()
})

function Camera({ commit, editable = true }: { commit: (angle: CameraAngle) => void; editable?: boolean }) {
  const [angle, setAngle] = useState(original)
  const [selected, select] = useState(false)
  return <CameraMarker angle={angle} selected={selected} editable={editable} pixelsToMeters={1} onSelect={() => select(true)} onCommit={(value) => { setAngle(value); commit(value) }} />
}
function drag(target: Element, finish = true) {
  fireEvent.pointerDown(target, { button: 0, clientX: 10, clientY: 60 })
  fireEvent.pointerMove(target, { clientX: 12, clientY: 64 })
  if (finish) fireEvent.pointerUp(target, { clientX: 12, clientY: 64 })
}
it('selects cameras and only commits their final dragged position', () => {
  const commit = vi.fn()
  render(<Surface><Camera commit={commit} /></Surface>)
  const button = screen.getByRole('button', { name: 'Move DSLR 1' })
  fireEvent.click(button)
  expect(button.className).toContain('ring-2')
  drag(button, false)
  expect(commit).not.toHaveBeenCalled()
  fireEvent.pointerUp(button, { clientX: 12, clientY: 64 })
  expect(commit).toHaveBeenCalledExactlyOnceWith({ ...original, position: { lat: 64, lng: 12 } })
})
it('cancels a drag without saving and restores the original camera position', () => {
  const commit = vi.fn()
  render(<Surface><Camera commit={commit} /></Surface>)
  const button = screen.getByRole('button', { name: 'Move DSLR 1' })
  drag(button, false)
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.pointerUp(button, { clientX: 12, clientY: 64 })
  expect(commit).not.toHaveBeenCalled()
  expect(button.parentElement!.parentElement).toHaveStyle({ left: '10px', top: '60px' })
})
it('supports keyboard aiming and leaves viewer arrows visible but disabled', () => {
  const commit = vi.fn()
  const result = render(<Surface><Camera commit={commit} /></Surface>)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Aim DSLR 1' }), { key: 'ArrowRight' })
  expect(commit).toHaveBeenLastCalledWith({ ...original, directionDegrees: 95 })
  result.unmount(); commit.mockClear()
  render(<Surface><Camera editable={false} commit={commit} /></Surface>)
  expect(screen.queryByRole('button', { name: 'Move DSLR 1' })).toBeNull()
  const arrow = screen.getByRole('button', { name: 'Aim DSLR 1' })
  expect(arrow).toBeDisabled()
  drag(arrow)
  fireEvent.keyDown(arrow, { key: 'ArrowRight' })
  expect(commit).not.toHaveBeenCalled()
})
it('leaves the rig interior to map navigation, omits the center icon and commits shape handle edits', () => {
  const rig: CircleRig = { id: 'rig', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.6, rotationDegrees: 0 }
  const select = vi.fn(), commit = vi.fn()
  const { container } = render(<Surface><RigObject rig={rig} pixelsToMeters={1} editable interactive selected onSelect={select} onCommit={commit} /></Surface>)
  fireEvent.click(container.querySelector('polygon')!)
  expect(container.querySelector('polygon')).toHaveStyle({ pointerEvents: 'none' })
  expect(select).not.toHaveBeenCalled()
  expect(commit).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Move circle rig' })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Adjust rig ovalness' }), { key: 'ArrowRight' })
  expect(commit).toHaveBeenLastCalledWith({ ...rig, ovalRatio: 0.65 })
  drag(screen.getByRole('button', { name: 'Scale and rotate circle rig' }))
  expect(commit.mock.lastCall![0].radiusMeters).not.toBe(80)
})

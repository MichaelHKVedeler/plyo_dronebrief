import { ShadeProjection } from './shade-projection'
import { useState, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { Map } from 'maplibre-gl'
import type { CameraAngle } from '@/features/briefs/model/brief'
import { CameraMarker } from './camera-marker'
import { RigObject, compactRigNumberScale, compactRigStrokeScale } from './rig-object'
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
afterEach(() => {
  cleanup()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
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

it('thickens the rig outline and enlarges numbers on a narrow viewport', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const rig: CircleRig = { id: 'rig', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 400, ovalRatio: 1, rotationDegrees: 0 }
  render(<Surface><RigObject rig={rig} pixelsToMeters={1} editable={false} interactive selected onSelect={vi.fn()} onCommit={vi.fn()} /></Surface>)
  await waitFor(() => expect(Number(document.querySelector('polygon')!.getAttribute('stroke-width'))).toBe(5 * compactRigStrokeScale))
  expect(screen.getByText('1').style.zoom).toBe(String(compactRigNumberScale))
})

it.each(['Scale and rotate circle rig', 'Adjust rig ovalness'])('keeps the outline highlighted when moving onto %s', (label) => {
  vi.useFakeTimers()
  try {
    const rig: CircleRig = { id: 'rig', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 400, ovalRatio: 0.6, rotationDegrees: 0 }
    const commit = vi.fn()
    const { container } = render(<Surface><canvas /><RigObject rig={rig} pixelsToMeters={1} editable interactive selected onSelect={vi.fn()} onCommit={commit} /></Surface>)
    const outline = container.querySelector('polygon')!
    const initial = outline.getAttribute('stroke-width')
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 60 })
    const highlighted = outline.getAttribute('stroke-width')
    expect(Number(highlighted)).toBeGreaterThan(Number(initial))
    const control = screen.getByRole('button', { name: label })
    fireEvent.mouseEnter(control)
    fireEvent.pointerMove(control, { clientX: 10, clientY: 60 })
    act(() => vi.advanceTimersByTime(500))
    expect(outline).toHaveAttribute('stroke-width', highlighted)
    fireEvent.mouseLeave(control)
    expect(outline).toHaveAttribute('stroke-width', initial)
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 60 })
    fireEvent.focus(screen.getByRole('button', { name: label }))
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 100, clientY: 100 })
    expect(outline).toHaveAttribute('stroke-width', highlighted)
    fireEvent.blur(screen.getByRole('button', { name: label }))
    expect(outline).toHaveAttribute('stroke-width', initial)
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 60 })
    fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 100, clientY: 100 })
    expect(outline).toHaveAttribute('stroke-width', initial)
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    expect(commit).not.toHaveBeenCalled()
  } finally {
    cleanup()
    vi.useRealTimers()
  }
})

function Camera({ commit, duplicate, editable = true }: { commit: (angle: CameraAngle) => void; duplicate?: (position: CameraAngle['position']) => void; editable?: boolean }) {
  const [angle, setAngle] = useState(original)
  const [selected, select] = useState(false)
  return <CameraMarker angle={angle} selected={selected} editable={editable} pixelsToMeters={1} duplicateNumber={2}
    onSelect={() => select(true)} onCommit={(value) => { setAngle(value); commit(value) }} onDuplicate={duplicate} />
}
it('reveals rig grab areas above overlapping cameras on hover, and removes them in viewer/export mode', () => {
  const rig: CircleRig = { id: 'rig', position: original.position, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.6, rotationDegrees: 0 }
  const commit = vi.fn(), cameraCommit = vi.fn()
  const scene = (editable: boolean) => <Surface>
    <RigObject rig={rig} pixelsToMeters={1} editable={editable} interactive selected={false} onSelect={vi.fn()} onCommit={commit} />
    <CameraMarker angle={original} selected editable={editable} pixelsToMeters={1} onSelect={vi.fn()} onCommit={cameraCommit} />
  </Surface>
  const view = render(scene(true))
  expect(screen.queryByRole('button', { name: 'Scale and rotate circle rig' })).not.toBeInTheDocument()
  fireEvent.pointerMove(screen.getByRole('button', { name: 'Move DSLR 1' }), { clientX: 10, clientY: 60 })
  const control = screen.getByRole('button', { name: 'Scale and rotate circle rig' })
  const marker = control.closest<HTMLElement>('[data-shade-object]')!
  const camera = screen.getByRole('button', { name: 'Move DSLR 1' }).closest<HTMLElement>('[data-shade-object]')!
  const aim = screen.getByRole('button', { name: 'Aim DSLR 1' }).closest<HTMLElement>('[data-shade-object]')!
  expect(Number(marker.style.zIndex)).toBeGreaterThan(Number(camera.style.zIndex))
  expect(Number(marker.style.zIndex)).toBeGreaterThan(Number(aim.style.zIndex))
  expect(control.parentElement).toHaveStyle({ minWidth: '32px', minHeight: '32px' })
  // Dragging the enlarged area around the small visual handle still edits the rig.
  drag(control.parentElement!)
  expect(commit).toHaveBeenCalledTimes(1)
  expect(cameraCommit).not.toHaveBeenCalled()
  view.rerender(scene(false))
  expect(screen.queryByRole('button', { name: 'Scale and rotate circle rig' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Adjust rig ovalness' })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Rig arrow 1, pointing toward center' })).toBeInTheDocument()
})
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
it('alt-drags a new camera while leaving the original in place', () => {
  const commit = vi.fn()
  const duplicate = vi.fn()
  render(<Surface><Camera commit={commit} duplicate={duplicate} /></Surface>)
  const button = screen.getByRole('button', { name: 'Move DSLR 1' })
  fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 60, altKey: true })
  fireEvent.pointerMove(button, { clientX: 12, clientY: 64, altKey: true })
  fireEvent.pointerUp(button, { clientX: 12, clientY: 64, altKey: true })
  expect(duplicate).toHaveBeenCalledExactlyOnceWith({ lat: 64, lng: 12 })
  expect(commit).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Move DSLR 1' }).parentElement!.parentElement).toHaveStyle({ left: '10px', top: '60px' })
})
it('cancels an alt-drag without adding a camera', () => {
  const commit = vi.fn()
  const duplicate = vi.fn()
  render(<Surface><Camera commit={commit} duplicate={duplicate} /></Surface>)
  const button = screen.getByRole('button', { name: 'Move DSLR 1' })
  fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 60, altKey: true })
  fireEvent.pointerMove(button, { clientX: 12, clientY: 64, altKey: true })
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.pointerUp(button, { clientX: 12, clientY: 64, altKey: true })
  expect(duplicate).not.toHaveBeenCalled()
  expect(commit).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Move DSLR 1' }).parentElement!.parentElement).toHaveStyle({ left: '10px', top: '60px' })
})
it('reprojects markers on map render without a React update', () => {
  let shift = { x: 0, y: 0 }
  const listeners = new Set<() => void>()
  const map = {
    getCanvas: () => document.querySelector('canvas'),
    getContainer: () => document.body.firstElementChild!,
    project: ([lng, lat]: number[]) => ({ x: lng + shift.x, y: lat + shift.y }),
    unproject: ([x, y]: number[]) => ({ lng: x, lat: y }),
    on: (_event: string, listener: () => void) => listeners.add(listener),
    off: (_event: string, listener: () => void) => listeners.delete(listener),
  } as unknown as Map
  render(<ShadeProjection value={map}><ObjectRenderer value={{ Marker: ShadeMarker, Polygon: ShadePolygon }}><div>
    <CameraMarker angle={original} selected={false} editable pixelsToMeters={1} onSelect={vi.fn()} onCommit={vi.fn()} />
  </div></ObjectRenderer></ShadeProjection>)
  const marker = screen.getByRole('button', { name: 'Move DSLR 1' }).parentElement!.parentElement
  expect(marker).toHaveStyle({ left: '10px', top: '60px' })
  shift = { x: 5, y: 8 }
  act(() => { for (const listener of listeners) listener() })
  expect(marker).toHaveStyle({ left: '15px', top: '68px' })
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
it('supports keyboard aiming after hover and leaves viewer arrows visible without handles', () => {
  const commit = vi.fn()
  const result = render(<Surface><Camera commit={commit} /></Surface>)
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Move DSLR 1' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Aim DSLR 1' }), { key: 'ArrowRight' })
  expect(commit).toHaveBeenLastCalledWith({ ...original, directionDegrees: 95 })
  result.unmount(); commit.mockClear()
  const view = render(<Surface><Camera editable={false} commit={commit} /></Surface>)
  expect(screen.queryByRole('button', { name: 'Move DSLR 1' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Aim DSLR 1' })).toBeNull()
  expect(view.container.querySelectorAll('[data-camera-arrow]')).toHaveLength(1)
  expect(commit).not.toHaveBeenCalled()
})
it('leaves the rig interior to map navigation, omits the center icon and commits shape handle edits', () => {
  const rig: CircleRig = { id: 'rig', position: { lat: 60, lng: 10 }, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.6, rotationDegrees: 0 }
  const select = vi.fn(), commit = vi.fn()
  const { container } = render(<Surface><canvas /><RigObject rig={rig} pixelsToMeters={1} editable interactive selected onSelect={select} onCommit={commit} /></Surface>)
  fireEvent.click(container.querySelector('polygon')!)
  expect(container.querySelector('polygon')).toHaveStyle({ pointerEvents: 'none' })
  expect(select).not.toHaveBeenCalled()
  expect(commit).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Move circle rig' })).not.toBeInTheDocument()
  fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 60 })
  fireEvent.keyDown(screen.getByRole('button', { name: 'Adjust rig ovalness' }), { key: 'ArrowRight' })
  expect(commit).toHaveBeenLastCalledWith({ ...rig, ovalRatio: 0.65 })
  fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 100, clientY: 100 })
  fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 10, clientY: 60 })
  drag(screen.getByRole('button', { name: 'Scale and rotate circle rig' }))
  expect(commit.mock.lastCall![0].radiusMeters).not.toBe(80)
})

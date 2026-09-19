import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { attachImageInteraction, type ImageLayerState } from './image-interaction'
import type { ImageOverlay } from '@/features/briefs/model/brief'
import { imageCorners, imagePosition, imageWorld } from './image-geometry'

beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent))
let detach: (() => void) | undefined
afterEach(() => { detach?.(); document.body.replaceChildren() })
const image: ImageOverlay = { id: 'image', name: 'Plan', source: 'data:image/png;base64,AAAA', position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 60, rotationDegrees: 0, opacity: 0.7 }
function setup() {
  const surface = document.createElement('div'); document.body.append(surface)
  const projection = { project: (p: typeof image.position) => { const w = imageWorld(p); return { x: w.x + 200, y: w.y + 200 } }, unproject: (p: { x: number; y: number }) => imagePosition({ x: p.x - 200, y: p.y - 200 }) }
  const state: ImageLayerState = { images: [image], editable: true, interactive: true, selectedId: image.id, anchors: {}, sourceUrl: () => 'blob:test', onSelect: vi.fn(), onAnchor: vi.fn(), onCommit: vi.fn() }
  const preview = vi.fn()
  detach = attachImageInteraction(surface, projection, () => state, preview)
  const down = (x = 150, y = 200, button = 0) => fireEvent.pointerDown(surface, { button, clientX: x, clientY: y })
  const move = (x = 170, y = 220) => fireEvent.pointerMove(window, { buttons: 1, clientX: x, clientY: y })
  const up = () => fireEvent.pointerUp(window, { button: 0 })
  return { surface, state, preview, down, move, up, projection }
}
it('previews edge movement and commits only once on release, suppressing map clicks', () => {
  const { surface, state, preview, down, move, up } = setup()
  const click = vi.fn(); surface.addEventListener('click', click)
  down(); move()
  const updated = preview.mock.lastCall![0] as ImageOverlay
  expect(updated.widthMeters).toBe(image.widthMeters)
  expect(updated.position).not.toEqual(image.position)
  expect(state.onCommit).not.toHaveBeenCalled()
  up(); fireEvent.click(surface)
  expect(state.onCommit).toHaveBeenCalledExactlyOnceWith(updated)
  expect(click).not.toHaveBeenCalled()
})
it('right-clicks outside the image to set an anchor, then scales and rotates from it', () => {
  const { surface, state, projection, down, move, up } = setup()
  fireEvent.contextMenu(surface, { clientX: 100, clientY: 100 })
  expect(state.onAnchor).toHaveBeenCalledExactlyOnceWith(image.id, projection.unproject({ x: 100, y: 100 }))
  state.anchors[image.id] = projection.unproject({ x: 100, y: 100 })
  down(220, 200); move(200, 250); up()
  const updated = vi.mocked(state.onCommit).mock.lastCall![0]
  expect(updated.rotationDegrees).toBeGreaterThan(0)
  expect(updated.widthMeters).toBeGreaterThan(image.widthMeters)
  expect(imageCorners(updated)).toHaveLength(4)
})
it('leaves right-clicks on 360 focus controls and active focus drags to the camera', () => {
  const { surface, state } = setup()
  const camera = document.createElement('button')
  camera.setAttribute('data-360-focus-control', '')
  surface.append(camera)
  fireEvent.contextMenu(camera, { clientX: 200, clientY: 200 })
  camera.setAttribute('data-360-focusing', '')
  fireEvent.contextMenu(surface, { clientX: 300, clientY: 200 })
  expect(state.onAnchor).not.toHaveBeenCalled()
})
it.each(['Escape', 'pointercancel', 'blur'])('discards the drag on %s', (type) => {
  const { state, preview, down, move, up } = setup()
  down(); move()
  if (type === 'Escape') fireEvent.keyDown(window, { key: type })
  else fireEvent(window, new Event(type))
  up()
  expect(preview).toHaveBeenLastCalledWith(null)
  expect(state.onCommit).not.toHaveBeenCalled()
})
it.each(['viewer', 'placement', 'hidden', 'missing', 'middle'])('leaves the map alone when %s', (mode) => {
  const { state, surface, down, move, up } = setup()
  if (mode === 'viewer') state.editable = false
  if (mode === 'placement') state.interactive = false
  if (mode === 'hidden') state.images = []
  if (mode === 'missing') state.sourceUrl = () => undefined
  down(150, 200, mode === 'middle' ? 1 : 0); move(); up()
  expect(state.onCommit).not.toHaveBeenCalled()
  if (mode !== 'middle') {
    fireEvent.contextMenu(surface, { clientX: 100, clientY: 100 })
    if (mode !== 'missing') expect(state.onAnchor).not.toHaveBeenCalled()
  }
})

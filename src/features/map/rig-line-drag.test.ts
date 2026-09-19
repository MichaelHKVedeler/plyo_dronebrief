import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { rigOutline, type CircleRig } from './geometry'
import { attachRigLineDrag, type RigLineDragProps, type RigProjection } from './rig-line-drag'

beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent))
let detach: (() => void) | undefined
afterEach(() => { detach?.(); document.body.replaceChildren() })
const rig: CircleRig = { id: 'rig', position: { lat: 0, lng: 0 }, radiusMeters: 100, ovalRatio: 0.6, rotationDegrees: 35, arrowCount: 10 }
const projection: RigProjection = {
  project: (p) => ({ x: 200 + p.lng * 111195, y: 200 - p.lat * 111195 }),
  unproject: (p) => ({ lng: (p.x - 200) / 111195, lat: (200 - p.y) / 111195 }),
}
function setup(interactive = true, acceptTarget?: (target: EventTarget | null) => boolean) {
  const surface = document.createElement('div')
  surface.innerHTML = '<svg><polygon data-rig-outline data-shade-object /></svg><button>Handle</button>'
  document.body.append(surface)
  const props: RigLineDragProps = { rig, strokeWidth: 1, interactive, onStart: vi.fn(), onPreview: vi.fn(), onCommit: vi.fn(), onCancel: vi.fn() }
  detach = attachRigLineDrag(surface, projection, () => props, acceptTarget)
  const edge = projection.project(rigOutline(rig)[16])!
  const target = surface.querySelector('polygon')!
  const down = (button = 0) => fireEvent.pointerDown(target, { button, clientX: edge.x, clientY: edge.y })
  const move = () => fireEvent.pointerMove(window, { clientX: edge.x + 20, clientY: edge.y - 30 })
  const up = () => fireEvent.pointerUp(window, { button: 0, clientX: edge.x + 20, clientY: edge.y - 30 })
  return { surface, target, props, edge, down, move, up }
}
it('grabs the thin outline without snapping the center and saves only on release', () => {
  const { props, down, move, up } = setup()
  down(); move()
  expect(props.onStart).toHaveBeenCalledOnce()
  const expected = projection.unproject({ x: 220, y: 170 })!
  const preview = vi.mocked(props.onPreview).mock.lastCall![0]
  expect(preview.lat).toBeCloseTo(expected.lat, 12)
  expect(preview.lng).toBeCloseTo(expected.lng, 12)
  expect(props.onCommit).not.toHaveBeenCalled()
  up()
  expect(props.onCommit).toHaveBeenCalledExactlyOnceWith(preview)
  expect(props.rig).toEqual(rig)
})
it.each(['Escape', 'pointercancel', 'blur'])('discards movement on %s', (event) => {
  const { props, down, move, up } = setup()
  down(); move()
  if (event === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  else fireEvent(window, new Event(event))
  up()
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onCommit).not.toHaveBeenCalled()
})
it.each([1, 2])('leaves mouse button %s to map navigation', (button) => {
  const { props, down, move, up } = setup()
  down(button); move(); up()
  expect(props.onPreview).not.toHaveBeenCalled()
  expect(props.onCommit).not.toHaveBeenCalled()
})
it('does not move in view/placement mode or intercept the interior and adjustment controls', () => {
  const { props, surface, target, edge, down, move, up } = setup(false)
  down(); move(); up()
  props.interactive = true
  fireEvent.pointerDown(target, { button: 0, clientX: 200, clientY: 200 }); move(); up()
  fireEvent.pointerDown(surface.querySelector('button')!, { button: 0, clientX: edge.x, clientY: edge.y }); move(); up()
  expect(props.onPreview).not.toHaveBeenCalled()
  expect(props.onCommit).not.toHaveBeenCalled()
})
it('selects on a line click without saving, and suppresses the subsequent map click', () => {
  const { props, target, edge, down } = setup()
  const click = vi.fn()
  target.addEventListener('click', click)
  down()
  fireEvent.pointerUp(window, { button: 0, clientX: edge.x, clientY: edge.y })
  fireEvent.click(target)
  expect(props.onStart).toHaveBeenCalledOnce()
  expect(props.onCommit).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

it('thickens the outline when the pointer is a little beside the line', () => {
  const { surface, target, edge, props } = setup()
  props.onHoverChange = vi.fn()
  fireEvent.pointerMove(target, { buttons: 0, clientX: edge.x + 8, clientY: edge.y })
  expect(surface).toHaveAttribute('data-rig-move-cursor', 'grab')
  expect(props.onHoverChange).toHaveBeenLastCalledWith(true)
  fireEvent.pointerMove(target, { buttons: 0, clientX: 200, clientY: 200 })
  expect(surface).not.toHaveAttribute('data-rig-move-cursor')
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
})

it('signals movement only over the outline and clears feedback on exit and cancellation', () => {
  const { surface, target, edge, props, down } = setup()
  props.onHoverChange = vi.fn()
  fireEvent.pointerMove(target, { buttons: 0, clientX: edge.x, clientY: edge.y })
  expect(surface).toHaveAttribute('data-rig-move-cursor', 'grab')
  expect(props.onHoverChange).toHaveBeenLastCalledWith(true)
  fireEvent.pointerMove(target, { buttons: 0, clientX: 200, clientY: 200 })
  expect(surface).not.toHaveAttribute('data-rig-move-cursor')
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
  down()
  expect(surface).toHaveAttribute('data-rig-move-cursor', 'grabbing')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(surface).not.toHaveAttribute('data-rig-move-cursor')
  props.interactive = false
  fireEvent.pointerMove(target, { buttons: 0, clientX: edge.x, clientY: edge.y })
  expect(surface).not.toHaveAttribute('data-rig-move-cursor')
  expect(props.onCommit).not.toHaveBeenCalled()
})

function bounds(element: Element, x: number, y: number, size = 32) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: x - size / 2, top: y - size / 2, right: x + size / 2, bottom: y + size / 2, width: size, height: size } as DOMRect)
}

it.each([false, true])('keeps hover across a rig camera arrow, icon, badge and aim handle without stealing camera drags (ShadeMap: %s)', (shade) => {
  const { surface, target, edge, props, move, up } = setup(true, shade ? (target) => target instanceof Element && target.matches('[data-rig-outline]') : undefined)
  props.onHoverChange = vi.fn()
  const camera = document.createElement('div')
  camera.setAttribute('data-camera-marker', 'camera-1')
  camera.innerHTML = '<button>Camera</button><span data-camera-arrow></span><span data-camera-badge></span>'
  surface.append(camera)
  bounds(camera, edge.x, edge.y)
  const arrow = { x: (edge.x + 200) / 2, y: (edge.y + 200) / 2 }
  bounds(camera.querySelector('[data-camera-arrow]')!, arrow.x, arrow.y)
  bounds(camera.querySelector('[data-camera-badge]')!, edge.x + 20, edge.y - 20, 20)
  const hover = (element: Element, x: number, y: number) => fireEvent.pointerMove(element, { buttons: 0, clientX: x, clientY: y })
  // First enter the non-interactive arrow, before any camera aim handle exists.
  hover(target, arrow.x, arrow.y)
  expect(props.onHoverChange).toHaveBeenCalledExactlyOnceWith(true)
  const aim = document.createElement('div')
  aim.setAttribute('data-camera-aim-handle', 'camera-1')
  aim.innerHTML = '<button>Aim camera</button>'
  surface.append(aim)
  hover(aim.firstElementChild!, arrow.x, arrow.y)
  hover(camera.firstElementChild!, edge.x, edge.y)
  hover(target, edge.x + 20, edge.y - 20)
  expect(props.onHoverChange).toHaveBeenCalledTimes(1)
  fireEvent.pointerDown(camera.firstElementChild!, { button: 0, clientX: edge.x, clientY: edge.y }); move(); up()
  fireEvent.pointerDown(aim.firstElementChild!, { button: 0, clientX: arrow.x, clientY: arrow.y }); move(); up()
  expect(props.onStart).not.toHaveBeenCalled()
  expect(props.onCommit).not.toHaveBeenCalled()
  hover(target, 200, 200)
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
  // Arrows of cameras away from the outline must not reveal the rig handles.
  bounds(camera, 200, 200)
  hover(aim.firstElementChild!, arrow.x, arrow.y)
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
  expect(surface).not.toHaveAttribute('data-rig-move-cursor')
})

it('reveals controls over the rig numbered badges and inward arrows beyond the outline hit area', () => {
  const { surface, target, props } = setup()
  props.onHoverChange = vi.fn()
  const decoration = document.createElement('div')
  decoration.setAttribute('data-rig-decoration', rig.id)
  decoration.innerHTML = '<span data-rig-hover></span><span data-rig-hover></span>'
  surface.append(decoration)
  bounds(decoration.children[0], 200, 160)
  bounds(decoration.children[1], 250, 200)
  for (const [x, y] of [[200, 160], [250, 200]]) {
    fireEvent.pointerMove(target, { buttons: 0, clientX: x, clientY: y })
    expect(props.onHoverChange).toHaveBeenLastCalledWith(true)
  }
  fireEvent.pointerMove(target, { buttons: 0, clientX: 200, clientY: 200 })
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
  props.interactive = false
  fireEvent.pointerMove(target, { buttons: 0, clientX: 200, clientY: 160 })
  expect(props.onHoverChange).toHaveBeenLastCalledWith(false)
})

import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FloorplanMaskViewer } from './floorplan-mask-viewer'
import type { ImageOverlay } from '../model/brief'

const overlay: ImageOverlay = { id: 'plan', name: 'Plan', source: 'data:image/png;base64,AAAA', position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 50, opacity: 1, rotationDegrees: 0 }
const save = vi.fn()
function Harness({ editable = true }: { editable?: boolean }) {
  const [image, setImage] = useState(overlay)
  return <FloorplanMaskViewer overlay={image} url={image.source as string} editable={editable} onChange={(mask) => { save(mask); setImage({ ...image, mask }) }} />
}
beforeEach(() => {
  save.mockClear(); vi.stubGlobal('PointerEvent', MouseEvent)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
  HTMLElement.prototype.setPointerCapture = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function draw() {
  fireEvent.click(screen.getByRole('button', { name: 'Draw floorplan mask' }))
  const canvas = screen.getByLabelText('Floorplan mask canvas')
  const svg = canvas.querySelector('svg')!
  for (const [x, y] of [[20, 20], [80, 20], [80, 80], [20, 80]]) fireEvent.pointerDown(svg, { button: 0, clientX: x, clientY: y })
  return canvas
}
it('closes by right-click, inserts a point, deletes a vertex, and clears the mask', () => {
  render(<Harness />); const canvas = draw()
  expect(save).not.toHaveBeenCalled()
  fireEvent.contextMenu(canvas)
  expect(save.mock.lastCall?.[0]).toHaveLength(4)
  expect(screen.getByRole('img').style.clipPath).toContain('polygon(')
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="0"]')!, { button: 0, ctrlKey: true, clientX: 50, clientY: 20 })
  fireEvent.pointerUp(canvas)
  expect(save.mock.lastCall?.[0]).toHaveLength(5)
  fireEvent.lostPointerCapture(canvas)
  fireEvent.keyDown(canvas, { key: 'Delete' })
  expect(save.mock.lastCall?.[0]).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Remove floorplan mask' }))
  expect(save.mock.lastCall?.[0]).toBeUndefined()
})
it('closes on the first point and commits segment movement only on release; Escape cancels vertex movement', () => {
  render(<Harness />); const canvas = draw()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-vertex="0"]')!, { button: 0 })
  save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="0"]')!, { button: 0, clientX: 50, clientY: 20 })
  fireEvent.pointerMove(canvas, { clientX: 50, clientY: 30 })
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerUp(canvas)
  expect(save.mock.lastCall?.[0][0].y).toBeCloseTo(0.3)
  expect(save.mock.lastCall?.[0][1].y).toBeCloseTo(0.3)
  save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-vertex="0"]')!, { button: 0, clientX: 20, clientY: 30 })
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 40 })
  fireEvent.keyDown(canvas, { key: 'Escape' }); fireEvent.pointerUp(canvas)
  expect(save).not.toHaveBeenCalled()
})
it('does not close incomplete masks, cancels drawing, and exposes image errors', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Draw floorplan mask' }))
  const canvas = screen.getByLabelText('Floorplan mask canvas')
  fireEvent.pointerDown(canvas.querySelector('svg')!, { button: 0, clientX: 20, clientY: 20 })
  fireEvent.contextMenu(canvas); expect(save).not.toHaveBeenCalled()
  fireEvent.keyDown(canvas, { key: 'Escape' })
  expect(canvas.querySelector('[data-mask-vertex]')).toBeNull()
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
})
it('has no editing controls in read-only mode', () => {
  render(<Harness editable={false} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByLabelText('Floorplan mask canvas').querySelector('svg')).toBeNull()
})

it('inserts and drags a new vertex in one gesture, saving only on release', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="0"]')!, { button: 0, ctrlKey: true, clientX: 50, clientY: 20 })
  expect(canvas.querySelectorAll('[data-mask-vertex]')).toHaveLength(5)
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerMove(canvas, { ctrlKey: true, clientX: 60, clientY: 40 })
  fireEvent.pointerUp(canvas)
  expect(save).toHaveBeenCalledOnce()
  expect(save.mock.lastCall?.[0][1]).toEqual({ x: 0.6, y: 0.4 })
  expect(save.mock.lastCall?.[0][0]).toEqual({ x: 0.2, y: 0.2 })
})
it.each(['escape', 'pointercancel', 'blur'])('cancels insertion without saving on %s', (reason) => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="3"]')!, { button: 0, ctrlKey: true, clientX: 20, clientY: 50 })
  fireEvent.pointerMove(canvas, { ctrlKey: true, clientX: 10, clientY: 40 })
  if (reason === 'escape') fireEvent.keyDown(canvas, { key: 'Escape' })
  else if (reason === 'blur') fireEvent.blur(window)
  else fireEvent.pointerCancel(canvas)
  fireEvent.pointerUp(canvas)
  expect(save).not.toHaveBeenCalled()
  expect(canvas.querySelectorAll('[data-mask-vertex]')).toHaveLength(4)
})
it('updates the modifier cursor without moving the mouse and clears it on blur', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas)
  const edge = canvas.querySelector<SVGElement>('[data-mask-edge="0"]')!
  expect(edge.style.cursor).toBe('crosshair')
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
  expect(edge.style.cursor).toContain('data:image/svg+xml')
  fireEvent.keyUp(window, { key: 'Control', ctrlKey: false })
  expect(edge.style.cursor).toBe('crosshair')
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true }); fireEvent.blur(window)
  expect(edge.style.cursor).toBe('crosshair')
})

it('shows a minus cursor with Alt and deletes only the clicked vertex, clearing a triangle', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  const vertex = canvas.querySelector<SVGElement>('[data-mask-vertex="0"]')!
  fireEvent.keyDown(window, { key: 'Alt', altKey: true })
  expect(vertex.style.cursor).toContain('data:image/svg+xml')
  const minus = vertex.style.cursor
  fireEvent.keyUp(window, { key: 'Alt' })
  expect(vertex.style.cursor).toBe('crosshair')
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
  expect(vertex.style.cursor).not.toBe(minus)
  fireEvent.pointerDown(vertex, { button: 0, altKey: true, ctrlKey: true })
  expect(save.mock.lastCall?.[0]).toEqual([{ x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }])
  fireEvent.pointerDown(canvas.querySelector('[data-mask-vertex="0"]')!, { button: 0, altKey: true })
  expect(save.mock.lastCall?.[0]).toBeUndefined()
})

it('clears Alt on release over a stationary vertex even if the host retains altKey and stops bubbling', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas)
  const vertex = canvas.querySelector<SVGElement>('[data-mask-vertex="0"]')!
  fireEvent.pointerEnter(canvas)
  fireEvent.keyDown(vertex, { key: 'Alt', altKey: true })
  expect(vertex.style.cursor).toContain('data:image/svg+xml')
  vertex.addEventListener('keyup', (event) => event.stopPropagation())
  fireEvent.keyUp(vertex, { key: 'Alt', altKey: true })
  expect(vertex.style.cursor).toBe('crosshair')
})

it('clicking empty space clears a selection without editing the mask', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  selectTop(canvas)
  fireEvent.pointerDown(canvas.querySelector('svg')!, { button: 0, clientX: 50, clientY: 50 })
  fireEvent.pointerUp(canvas)
  fireEvent.keyDown(canvas, { key: 'Delete' })
  expect(save).not.toHaveBeenCalled()
  expect(canvas.querySelectorAll('[data-mask-vertex]')).toHaveLength(4)
})

function selectTop(canvas: HTMLElement) {
  fireEvent.pointerDown(canvas.querySelector('svg')!, { button: 0, clientX: 90, clientY: 30 })
  fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
  fireEvent.pointerUp(canvas)
  fireEvent.lostPointerCapture(canvas)
}

it('selects vertices with a reverse-direction rectangle without saving and drags them together', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  selectTop(canvas)
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerDown(canvas.querySelector('[data-mask-vertex="0"]')!, { button: 0, clientX: 20, clientY: 20 })
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 40 })
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerUp(canvas)
  expect(save).toHaveBeenCalledOnce()
  const result = save.mock.lastCall?.[0]
  expect(result[0].x).toBeCloseTo(0.3)
  expect(result[0].y).toBeCloseTo(0.4)
  expect(result[1].x).toBeCloseTo(0.9)
  expect(result[1].y).toBeCloseTo(0.4)
  expect(result[2]).toEqual({ x: 0.8, y: 0.8 })
})

it('deletes a box selection and clears the mask when fewer than three vertices remain', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  selectTop(canvas)
  fireEvent.keyDown(canvas, { key: 'Delete' })
  expect(save).toHaveBeenCalledExactlyOnceWith(undefined)
})

it('moves the entire selection from a selected edge and preserves it after release', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('svg')!, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(canvas, { clientX: 90, clientY: 90 }); fireEvent.pointerUp(canvas)
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="0"]')!, { button: 0, clientX: 50, clientY: 20 })
  fireEvent.pointerMove(canvas, { clientX: 60, clientY: 30 })
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerUp(canvas); fireEvent.lostPointerCapture(canvas)
  expect(save).toHaveBeenCalledOnce()
  const result = save.mock.lastCall?.[0]
  for (const [index, point] of [{ x: .3, y: .3 }, { x: .9, y: .3 }, { x: .9, y: .9 }, { x: .3, y: .9 }].entries()) {
    expect(result[index].x).toBeCloseTo(point.x)
    expect(result[index].y).toBeCloseTo(point.y)
  }
  fireEvent.keyDown(canvas, { key: 'Delete' })
  expect(save.mock.lastCall?.[0]).toBeUndefined()
})

it('keeps Ctrl insertion on a selected edge limited to the new vertex', () => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  selectTop(canvas)
  fireEvent.pointerDown(canvas.querySelector('[data-mask-edge="0"]')!, { button: 0, ctrlKey: true, clientX: 50, clientY: 20 })
  fireEvent.pointerMove(canvas, { ctrlKey: true, clientX: 50, clientY: 40 }); fireEvent.pointerUp(canvas)
  expect(save.mock.lastCall?.[0][0]).toEqual({ x: .2, y: .2 })
  expect(save.mock.lastCall?.[0][1]).toEqual({ x: .5, y: .4 })
  expect(save.mock.lastCall?.[0][2]).toEqual({ x: .8, y: .2 })
})

it.each(['Escape', 'pointercancel', 'blur'])('cancels rectangle selection with %s without saving', (reason) => {
  render(<Harness />); const canvas = draw(); fireEvent.contextMenu(canvas); save.mockClear()
  fireEvent.pointerDown(canvas.querySelector('svg')!, { button: 0, clientX: 90, clientY: 30 })
  fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
  if (reason === 'Escape') fireEvent.keyDown(canvas, { key: 'Escape' })
  else if (reason === 'blur') fireEvent.blur(window)
  else fireEvent.pointerCancel(canvas)
  fireEvent.pointerUp(canvas)
  fireEvent.keyDown(canvas, { key: 'Delete' })
  expect(save).not.toHaveBeenCalled()
  expect(canvas.querySelector('[data-mask-selection]')).toBeNull()
})

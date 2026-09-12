import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraReorderHandle, type CameraDragPreview } from './camera-reorder-handle'
import type { CameraAngle } from '../model/brief'
import { createBrief } from '../model/brief'
import { CamerasPanel } from './cameras-panel'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

it.each([{ y: 140, offset: 96, target: 'a' }, { y: 90, offset: 80, target: 'a' }, { y: 114, offset: 96, target: 'c' }])('targets $target at pointer position $y and only commits a valid swap', ({ y, offset, target }) => {
  vi.useFakeTimers()
  vi.stubGlobal('PointerEvent', MouseEvent)
  const move = vi.fn()
  const points: CameraAngle[] = ['a', 'b', 'c'].map((id) => ({ id, label: id, type: '360', position: { lat: 60, lng: 10 } }))
  function Fixture() {
    const [preview, setPreview] = useState<CameraDragPreview | null>(null)
    return <><div>{points.map((angle) => <div key={angle.id} data-camera-row={angle.id}>
      <CameraReorderHandle angle={angle} name={angle.id} points={points} onMove={move} onPreview={setPreview} />
    </div>)}</div><output data-testid="preview">{JSON.stringify(preview)}</output></>
  }
  const view = render(<Fixture />)
  const rows = view.container.querySelectorAll('[data-camera-row]')
  rows.forEach((row, index) => vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: index * 48, height: 36 } as DOMRect))
  const grip = screen.getByRole('button', { name: 'Reorder a' })
  Object.assign(grip, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
  fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 10 })
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: y })
  expect(screen.getByTestId('preview')).toHaveTextContent('"target":"' + target + '"')
  expect(screen.getByTestId('preview')).toHaveTextContent('"offset":' + offset)
  expect(move).not.toHaveBeenCalled()
  fireEvent.pointerUp(grip, { pointerId: 1 })
  expect(screen.getByTestId('preview')).toHaveTextContent('"settling":true')
  expect(move).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(160))
  if (target === 'a') expect(move).not.toHaveBeenCalled()
  else expect(move).toHaveBeenCalledExactlyOnceWith('a', target)
  move.mockClear()
  fireEvent.pointerDown(grip, { button: 0, pointerId: 2, clientY: 10 })
  fireEvent.pointerMove(grip, { pointerId: 2, clientY: 70 })
  fireEvent.keyDown(grip, { key: 'Escape' })
  act(() => vi.runAllTimers())
  expect(screen.getByTestId('preview')).toHaveTextContent('null')
  expect(move).not.toHaveBeenCalled()
})

it('keeps other rows still and marks only the swap target without saving the preview', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const brief = createBrief({ name: 'Markers', clientName: 'Test', date: '2026-09-12', times: ['12:00'] })
  brief.angles = ['a', 'b', 'c'].map((id) => ({ id, label: id, type: '360', position: brief.coordinates }))
  const update = vi.fn()
  const view = render(<CamerasPanel brief={brief} selectedId={null} selectedCameraIds={[]} onCenterCamera={vi.fn()} onSelectCamera={vi.fn()} onRemoveCameras={vi.fn()} onUpdate={update} />)
  const rows = view.container.querySelectorAll<HTMLElement>('[data-camera-row]')
  rows.forEach((row, index) => vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: index * 48, height: 36 } as DOMRect))
  const grip = screen.getByRole('button', { name: 'Reorder 360 1' })
  Object.assign(grip, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
  fireEvent.pointerDown(grip, { button: 0, clientY: 18 })
  fireEvent.pointerMove(grip, { clientY: 90 })
  expect(screen.queryByLabelText('Insert point here')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Swap with 360 3')).not.toBeInTheDocument()
  fireEvent.pointerMove(grip, { clientY: 114 })
  expect(screen.getByLabelText('Swap with 360 3').parentElement).toBe(rows[2])
  expect(screen.queryByLabelText('Insert point here')).not.toBeInTheDocument()
  for (const row of [rows[1], rows[2]]) {
    expect(row.style.transform).toBe('')
    expect(row.querySelector<HTMLElement>('[data-dragging]')).toBeNull()
    expect(Array.from(row.querySelectorAll<HTMLElement>('[style]')).every((element) => !element.style.transform)).toBe(true)
  }
  expect(update).not.toHaveBeenCalled()
  fireEvent.pointerCancel(grip)
  expect(screen.queryByLabelText('Swap with 360 3')).not.toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})

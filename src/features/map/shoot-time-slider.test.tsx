import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ShootSlot } from '@/features/briefs/model/brief'
import { ShootTimeSlider } from './shoot-time-slider'
import { previewShootSlot, type ShootEndpoint } from './shoot-time-range'

const commit = vi.fn()
function Control({ initial = { date: '2026-09-19', time: '09:00' } }: { initial?: ShootSlot }) {
  const [slot, setSlot] = useState(initial), [endpoint, setEndpoint] = useState<ShootEndpoint>(0)
  return <><ShootTimeSlider slot={slot} name="Shoot" zone="Europe/Oslo" active endpoint={endpoint}
    onSelect={setEndpoint} onPreview={setSlot} onCommit={commit} />
    <output aria-label="Preview">{previewShootSlot(slot, endpoint).time}</output></>
}
beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
  HTMLElement.prototype.hasPointerCapture = () => true
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, bottom: 20, right: 1440, width: 1440, height: 20, toJSON() { return this },
  } as DOMRect)
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); commit.mockReset()
  for (const key of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture']) Reflect.deleteProperty(HTMLElement.prototype, key)
})
function track() { return document.querySelector('[data-slot="slider-track"]')! }

it.each([360, 840])('right-click adds one endpoint at %i without moving the current shadow instant', (clientX) => {
  render(<Control />)
  fireEvent.contextMenu(track(), { clientX })
  expect(screen.getAllByRole('slider')).toHaveLength(2)
  expect(screen.getByLabelText('Preview')).toHaveTextContent('09:00')
  expect(commit).toHaveBeenCalledTimes(1)
  const saved = commit.mock.calls[0][0]
  expect(saved).toMatchObject(clientX === 360 ? { time: '06:00', endTime: '09:00' } : { time: '09:00', endTime: '14:00' })
  fireEvent.contextMenu(track(), { clientX: 1000 })
  expect(screen.getAllByRole('slider')).toHaveLength(2)
  expect(commit).toHaveBeenCalledTimes(1)
})
it('selects endpoints without saving and track drags move the selected endpoint, even nearer the other one', () => {
  render(<Control initial={{ date: '2026-09-19', time: '09:00', endTime: '14:00' }} />)
  const end = screen.getByRole('slider', { name: 'Shoot end' })
  fireEvent.pointerDown(end, { button: 0, pointerId: 1, clientX: 840 })
  fireEvent.pointerUp(track(), { button: 0, pointerId: 1 })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('14:00')
  expect(commit).not.toHaveBeenCalled()
  fireEvent.pointerDown(track(), { button: 0, pointerId: 2, clientX: 600 })
  fireEvent.pointerMove(track(), { pointerId: 2, clientX: 615 })
  expect(screen.getByRole('slider', { name: 'Shoot start' })).toHaveAttribute('aria-valuetext', '09:00 Europe/Oslo')
  expect(screen.getByLabelText('Preview')).toHaveTextContent('10:15')
  expect(commit).not.toHaveBeenCalled()
  fireEvent.pointerUp(track(), { button: 0, pointerId: 2 })
  expect(commit).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-19', time: '09:00', endTime: '10:15' })
})
it.each(['escape', 'cancel', 'blur'])('discards an unfinished range drag on %s', (reason) => {
  render(<Control initial={{ date: '2026-09-19', time: '09:00', endTime: '14:00' }} />)
  fireEvent.pointerDown(track(), { button: 0, pointerId: 1, clientX: 700 })
  fireEvent.pointerMove(track(), { pointerId: 1, clientX: 720 })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('12:00')
  if (reason === 'escape') fireEvent.keyDown(window, { key: 'Escape' })
  else if (reason === 'cancel') fireEvent.pointerCancel(track(), { pointerId: 1 })
  else fireEvent.blur(window)
  fireEvent.pointerUp(track(), { pointerId: 1 })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('09:00')
  expect(commit).not.toHaveBeenCalled()
})
it('supports keyboard edits without crossing endpoints and reaches the full last minute', () => {
  render(<Control initial={{ date: '2026-09-19', time: '09:00', endTime: '14:00' }} />)
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Shoot start' }), { key: 'End' })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('13:59')
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Shoot end' }), { key: 'Home' })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('14:00')
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Shoot end' }), { key: 'End' })
  expect(screen.getByLabelText('Preview')).toHaveTextContent('23:59')
  expect(commit).toHaveBeenCalledTimes(2)
})
it('discards an unfinished preview when its editor closes', () => {
  const slot = { date: '2026-09-19', time: '09:00', endTime: '14:00' }, preview = vi.fn()
  const view = render(<ShootTimeSlider slot={slot} name="Shoot" zone="Europe/Oslo" active endpoint={0}
    onSelect={vi.fn()} onPreview={preview} onCommit={commit} />)
  fireEvent.pointerDown(track(), { button: 0, pointerId: 1, clientX: 720 })
  expect(preview).toHaveBeenLastCalledWith({ ...slot, time: '12:00' })
  view.unmount()
  expect(preview).toHaveBeenLastCalledWith(slot)
  expect(commit).not.toHaveBeenCalled()
})

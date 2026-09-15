import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShadowTimeControl } from './shadow-time-control'
import type { ShootSlot } from '@/features/briefs/model/brief'

afterEach(cleanup)
const oslo = { lat: 59.91, lng: 10.75 }
function Control({ initial = [{ date: '2026-09-11', time: '09:00' }] }: { initial?: ShootSlot[] }) {
  const [slots, setSlots] = useState(initial)
  const [activeIndex, setActiveIndex] = useState(0)
  return <ShadowTimeControl slots={slots} activeIndex={activeIndex} onActivate={setActiveIndex} onChange={setSlots} onCommit={setSlots} position={oslo} />
}

it('keeps one shared date on the header and stacks up to three times', async () => {
  const user = userEvent.setup()
  render(<Control />)
  expect(screen.getByRole('slider', { name: 'Shadow time' })).toHaveAttribute('aria-valuetext', expect.stringContaining('09:00'))
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-11')
  expect(screen.queryByLabelText('Shadow date 2')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add time' }))
  expect(screen.getByRole('slider', { name: 'Shadow time 2' })).toHaveAttribute('aria-valuetext', expect.stringContaining('09:15'))
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-11')
  fireEvent.change(screen.getByLabelText('Shadow date'), { target: { value: '2026-09-12' } })
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-12')
  const first = screen.getByRole('slider', { name: 'Shadow time 1' })
  first.focus()
  await user.keyboard('{ArrowRight}')
  expect(first).toHaveAttribute('aria-valuetext', expect.stringContaining('09:15'))
  await user.click(screen.getByRole('button', { name: 'Add time' }))
  expect(screen.getByRole('slider', { name: 'Shadow time 3' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add time' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-12')
  await user.click(screen.getByRole('button', { name: 'Remove Shadow time 2' }))
  expect(screen.queryByRole('slider', { name: 'Shadow time 3' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add time' })).toBeInTheDocument()
})

it('keeps the shared date beside the collapse control and shows times when collapsed', async () => {
  const user = userEvent.setup()
  render(<Control initial={[{ date: '2026-09-11', time: '09:00' }, { date: '2026-09-11', time: '15:15' }]} />)
  await user.click(screen.getByRole('button', { name: 'Collapse times' }))
  expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add time' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-11')
  expect(screen.getByRole('button', { name: 'Shadow time 1' })).toHaveTextContent('09:00')
  expect(screen.getByRole('button', { name: 'Shadow time 2' })).toHaveTextContent('15:15')
  await user.click(screen.getByRole('button', { name: 'Shadow time 2' }))
  expect(screen.getByRole('button', { name: 'Shadow time 2' })).toHaveAttribute('aria-current', 'true')
  await user.click(screen.getByRole('button', { name: 'Expand times' }))
  expect(screen.getByRole('slider', { name: 'Shadow time 2' })).toBeInTheDocument()
  expect(screen.getByLabelText('Shadow date')).toHaveValue('2026-09-11')
})

it('activates from a slider track without typing or jumping the time', async () => {
  const user = userEvent.setup()
  HTMLElement.prototype.setPointerCapture = function setPointerCapture() {}
  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture() {}
  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture() { return false }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, bottom: 10, right: 240, width: 240, height: 10, toJSON() { return this },
  } as DOMRect)
  try {
    render(<Control initial={[{ date: '2026-09-11', time: '09:00' }, { date: '2026-09-11', time: '15:15' }]} />)
    const date = screen.getByLabelText('Shadow date')
    await user.type(date, '20250101')
    expect(date).toHaveValue('2026-09-11')
    const tracks = document.querySelectorAll('[data-slot="slider-track"]')
    expect(tracks).toHaveLength(2)
    fireEvent.pointerDown(tracks[1])
    fireEvent.pointerDown(tracks[0])
    expect(screen.getByRole('slider', { name: 'Shadow time 1' })).toHaveAttribute('aria-valuetext', expect.stringContaining('09:00'))
    fireEvent.pointerDown(tracks[1])
    expect(screen.getByRole('slider', { name: 'Shadow time 2' })).toHaveAttribute('aria-valuetext', expect.stringContaining('15:15'))
    fireEvent.pointerDown(tracks[1], { clientX: 200, clientY: 5 })
    expect(screen.getByRole('slider', { name: 'Shadow time 2' })).not.toHaveAttribute('aria-valuetext', expect.stringContaining('15:15'))
  } finally {
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
    Reflect.deleteProperty(HTMLElement.prototype, 'releasePointerCapture')
    Reflect.deleteProperty(HTMLElement.prototype, 'hasPointerCapture')
  }
})

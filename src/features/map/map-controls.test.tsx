import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '@/features/briefs/model/brief'
import { MapControls } from './map-controls'

const map = vi.hoisted(() => ({
  fitBounds: vi.fn(), panTo: vi.fn(), moveCamera: vi.fn(), setZoom: vi.fn(), getZoom: () => 17,
  getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
}))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => map }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const brief = createBrief({ name: 'Framed', clientName: 'Client', date: '2026-09-11', times: ['09:00'] })
brief.angles = [{ id: 'a', label: 'A', type: '360', position: { lat: 59, lng: 10 } }]

it('frames on opening, preserves the view during edits, and supports explicit reframing', async () => {
  const user = userEvent.setup()
  const view = render(<MapControls brief={brief} />)
  expect(map.fitBounds).toHaveBeenCalledTimes(1)
  const edited = { ...brief, angles: [{ ...brief.angles[0], position: { lat: 61, lng: 12 } }] }
  view.rerender(<MapControls brief={edited} />)
  expect(map.fitBounds).toHaveBeenCalledTimes(1)
  expect(map.panTo).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Frame scene' }))
  expect(map.fitBounds).toHaveBeenCalledTimes(2)
  expect(map.fitBounds.mock.calls[1][0].north).toBeGreaterThan(61)
})
it('frames a different project and gives an empty new brief a world view', () => {
  const view = render(<MapControls brief={brief} />)
  view.rerender(<MapControls brief={{ ...brief, id: 'another' }} />)
  expect(map.fitBounds).toHaveBeenCalledTimes(2)
  view.rerender(<MapControls brief={{ ...brief, id: 'empty', angles: [] }} />)
  expect(map.moveCamera).toHaveBeenCalledWith({ center: { lat: 0, lng: 0 }, zoom: 2 })
})

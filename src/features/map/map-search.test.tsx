import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapSearch } from './map-search'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), fitBounds: vi.fn() }))
vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => ({ getBounds: () => undefined, fitBounds: mocks.fitBounds, getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }) }),
  useMapsLibrary: () => ({ Geocoder: class { geocode = mocks.geocode } }),
}))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
const result = { place_id: 'oslo', formatted_address: 'Oslo, Norway', geometry: { viewport: { north: 60, south: 59, east: 11, west: 10 } } }

it('searches on submit and navigates only after choosing a result', async () => {
  mocks.geocode.mockResolvedValue({ results: [result] })
  const user = userEvent.setup(); render(<MapSearch />)
  await user.type(screen.getByLabelText('Search street or location'), 'Oslo{Enter}')
  await screen.findByRole('button', { name: 'Oslo, Norway' })
  expect(mocks.fitBounds).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Oslo, Norway' }))
  expect(mocks.fitBounds).toHaveBeenCalledWith(result.geometry.viewport, expect.any(Object))
  expect(screen.queryByRole('button', { name: 'Oslo, Norway' })).not.toBeInTheDocument()
})
it.each([
  ['ZERO_RESULTS', /No locations found/],
  ['REQUEST_DENIED', /Enable the Geocoding API/],
  ['OVER_QUERY_LIMIT', /unavailable right now/],
])('shows an actionable message for %s', async (code, message) => {
  mocks.geocode.mockRejectedValue({ code })
  const user = userEvent.setup(); render(<MapSearch />)
  await user.type(screen.getByLabelText('Search street or location'), 'Street{Enter}')
  expect(await screen.findByRole('status')).toHaveTextContent(message)
})
it('ignores a late result after the user clears their search', async () => {
  let finish!: (value: unknown) => void
  mocks.geocode.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const user = userEvent.setup(); render(<MapSearch />)
  await user.type(screen.getByLabelText('Search street or location'), 'Oslo{Enter}')
  await user.click(screen.getByRole('button', { name: 'Clear location search' }))
  await act(async () => finish({ results: [result] }))
  expect(screen.queryByRole('button', { name: 'Oslo, Norway' })).not.toBeInTheDocument()
  expect(mocks.fitBounds).not.toHaveBeenCalled()
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapSearch } from './map-search'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), fitBounds: vi.fn(), suggest: vi.fn(), fetchFields: vi.fn() }))
vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => ({ getBounds: () => undefined, fitBounds: mocks.fitBounds, getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }) }),
  useMapsLibrary: (name: string) => name === 'places' ? { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: mocks.suggest } } : { Geocoder: class { geocode = mocks.geocode } },
}))
beforeEach(() => { vi.clearAllMocks(); mocks.suggest.mockResolvedValue({ suggestions: [] }) })
afterEach(cleanup)
const result = { place_id: 'oslo', formatted_address: 'Oslo, Norway', geometry: { viewport: { north: 60, south: 59, east: 11, west: 10 } } }
const prediction = { placeId: 'oslo', text: { toString: () => 'Oslo suggestion' }, toPlace: () => ({ fetchFields: mocks.fetchFields, viewport: result.geometry.viewport }) }

it('suggests while typing and loads details only when a suggestion is selected', async () => {
  mocks.suggest.mockResolvedValue({ suggestions: [{ placePrediction: prediction }] })
  mocks.fetchFields.mockResolvedValue({})
  const user = userEvent.setup(); render(<MapSearch />)
  await user.type(screen.getByLabelText('Search street or location'), 'Osl')
  await screen.findByRole('button', { name: 'Oslo suggestion' })
  expect(mocks.suggest).toHaveBeenCalledTimes(1)
  expect(mocks.fetchFields).not.toHaveBeenCalled()
  expect(mocks.fitBounds).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Oslo suggestion' }))
  expect(mocks.fetchFields).toHaveBeenCalledWith({ fields: ['location', 'viewport'] })
  expect(mocks.fitBounds).toHaveBeenCalledWith(result.geometry.viewport, expect.any(Object))
})
it('cancels suggestions on Escape and ignores pending results after a query changes', async () => {
  let finish!: (value: unknown) => void
  mocks.suggest.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const user = userEvent.setup(); render(<MapSearch />)
  await user.type(screen.getByLabelText('Search street or location'), 'Osl')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
  await user.clear(screen.getByLabelText('Search street or location'))
  await act(async () => finish({ suggestions: [{ placePrediction: prediction }] }))
  expect(screen.queryByRole('button', { name: 'Oslo suggestion' })).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Search street or location'), 'Bergen{Escape}')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
  expect(mocks.suggest).toHaveBeenCalledTimes(1)
})

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

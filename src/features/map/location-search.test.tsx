import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocationSearch } from './location-search'

vi.mock('@vis.gl/react-google-maps', () => ({
  APILoadingStatus: { LOADED: 'loaded' },
  useApiLoadingStatus: () => 'loaded',
}))

class FakeAutocomplete extends HTMLElement { locationBias = null }
customElements.define('test-place-search', FakeAutocomplete)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function setup() {
  vi.stubGlobal('google', { maps: { importLibrary: vi.fn().mockResolvedValue({ PlaceAutocompleteElement: FakeAutocomplete }) } })
  const onPosition = vi.fn()
  const result = render(<LocationSearch position={{ lat: 59.9139, lng: 10.7522 }} onPosition={onPosition} />)
  const widget = await screen.findByLabelText('Search location')
  return { ...result, widget, onPosition }
}

it('loads a selected Google place and sends only plain coordinates to the brief', async () => {
  const { widget, onPosition } = await setup()
  const fetchFields = vi.fn().mockResolvedValue({})
  fireEvent(widget, Object.assign(new Event('gmp-select'), { placePrediction: { toPlace: () => ({ fetchFields, location: { toJSON: () => ({ lat: 60.39, lng: 5.32 }) } }) } }))
  await waitFor(() => expect(onPosition).toHaveBeenCalledWith({ lat: 60.39, lng: 5.32 }))
  expect(fetchFields).toHaveBeenCalledWith({ fields: ['location'] })
})

it('shows a failed lookup without changing the project location', async () => {
  const { widget, onPosition } = await setup()
  fireEvent(widget, Object.assign(new Event('gmp-select'), { placePrediction: { toPlace: () => ({ fetchFields: vi.fn().mockRejectedValue(new Error('offline')) }) } }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this location')
  expect(onPosition).not.toHaveBeenCalled()
})

it('ignores a pending place lookup after leaving the editor', async () => {
  const { widget, onPosition, unmount } = await setup()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  fireEvent(widget, Object.assign(new Event('gmp-select'), { placePrediction: { toPlace: () => ({ fetchFields: () => pending, location: { toJSON: () => ({ lat: 60, lng: 5 }) } }) } }))
  unmount()
  finish()
  await pending
  expect(onPosition).not.toHaveBeenCalled()
})

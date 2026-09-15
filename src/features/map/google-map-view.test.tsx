import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GoogleMapView } from './google-map-view'

const map = vi.hoisted(() => ({ moveCamera: vi.fn(), setMapTypeId: vi.fn() }))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => map }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('restores the shared camera before paint when Google Maps becomes active', () => {
  const view = { current: { center: { lat: 59.91, lng: 10.75 }, zoom: 18.5 } }
  const { rerender } = render(<GoogleMapView active={false} satellite={false} view={view} />)
  expect(map.moveCamera).not.toHaveBeenCalled()
  rerender(<GoogleMapView active satellite={false} view={view} />)
  expect(map.moveCamera).toHaveBeenCalledExactlyOnceWith({ center: view.current.center, zoom: 18.5, heading: 0, tilt: 0 })
})

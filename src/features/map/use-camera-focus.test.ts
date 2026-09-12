import { expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCameraFocus } from './use-camera-focus'
import type { MapNavigation } from './map-navigation'

it('pans once per request and supports repeated clicks without changing zoom', () => {
  const panTo = vi.fn()
  const setZoom = vi.fn()
  const navigation = { panTo, setZoom } as unknown as MapNavigation
  const position = { lat: 60, lng: 10 }
  const view = renderHook(({ point }) => useCameraFocus(point, navigation), { initialProps: { point: position } })
  expect(panTo).toHaveBeenCalledWith(position)
  view.rerender({ point: position })
  expect(panTo).toHaveBeenCalledTimes(1)
  view.rerender({ point: { ...position } })
  expect(panTo).toHaveBeenCalledTimes(2)
  expect(setZoom).not.toHaveBeenCalled()
})

import { useLayoutEffect, useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map } from 'maplibre-gl'
import { attachShadeViewSync } from './shade-view-sync'
import type { MapView } from './map-view'

afterEach(cleanup)

it('commits pan, zoom and resize in the map render frame, skips unchanged frames and detaches', () => {
  let center = { lat: 60, lng: 10 }, zoom = 16
  const canvas = { width: 800, height: 600 }
  const listeners = new Set<() => void>()
  const map = {
    getCenter: () => center, getZoom: () => zoom, getCanvas: () => canvas,
    on: (_event: string, listener: () => void) => listeners.add(listener),
    off: (_event: string, listener: () => void) => listeners.delete(listener),
  } as unknown as Map
  let update: (view: MapView) => void = () => {}
  function Overlay() {
    const [view, setView] = useState<MapView>({ center, zoom: 17 })
    useLayoutEffect(() => { update = setView }, [])
    return <output data-testid="overlay">{view.center.lng},{view.center.lat},{view.zoom}</output>
  }
  render(<Overlay />)
  const commit = vi.fn((view: MapView) => update(view))
  const detach = attachShadeViewSync(map, commit)
  const frame = (expected: string) => act(() => {
    for (const listener of listeners) listener()
    // Assert inside the event, before act can flush deferred React updates.
    expect(screen.getByTestId('overlay')).toHaveTextContent(expected)
  })
  frame('10,60,17')
  center = { lat: 61, lng: 12 }
  frame('12,61,17')
  zoom = 17.5
  frame('12,61,18.5')
  frame('12,61,18.5')
  expect(commit).toHaveBeenCalledTimes(3)
  canvas.width = 390
  frame('12,61,18.5')
  expect(commit).toHaveBeenCalledTimes(4)
  detach()
  expect(listeners.size).toBe(0)
})

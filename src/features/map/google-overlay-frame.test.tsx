import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GoogleOverlayFrame } from './google-overlay-frame'
import { mapObjectScale } from './map-object-scale'

const sdk = vi.hoisted(() => ({ map: {}, width: 256 * 2 ** 17, frame: null as null | { draw: () => void; setMap: (map: unknown) => void } }))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => sdk.map }))

beforeEach(() => {
  sdk.width = 256 * 2 ** 17
  vi.stubGlobal('google', { maps: { OverlayView: class {
    constructor() { sdk.frame = this as unknown as typeof sdk.frame }
    getProjection() { return { getWorldWidth: () => sdk.width } }
    setMap = vi.fn((map: unknown) => { if (map) (this as unknown as { draw: () => void }).draw() })
  } } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sdk.frame = null })

const scene = (announcedZoom: number) => <GoogleOverlayFrame initialZoom={announcedZoom}>
  {(zoom) => <output data-testid="scale">{mapObjectScale(zoom)}</output>}
</GoogleOverlayFrame>

it('keeps scale on the drawn projection when camera events announce a future zoom, then commits in the drawing frame', () => {
  const view = render(scene(17))
  expect(screen.getByTestId('scale')).toHaveTextContent('1')
  // This camera update arrives before the map has drawn its new projection.
  view.rerender(scene(18.25))
  expect(screen.getByTestId('scale')).toHaveTextContent('1')
  for (const zoom of [17.125, 17.5, 18.25, 17.75, 16.5]) {
    sdk.width = 256 * 2 ** zoom
    act(() => {
      sdk.frame!.draw()
      // Assert before act flushes: map geometry and icons must paint together.
      expect(Number(screen.getByTestId('scale').textContent)).toBeCloseTo(2 ** (zoom - 17), 10)
    })
  }
})

it('uses the projection on attachment, ignores unready draws, skips unchanged frames and detaches', () => {
  const paint = vi.fn((zoom: number) => <output data-testid="scale">{mapObjectScale(zoom)}</output>)
  const view = render(<GoogleOverlayFrame initialZoom={10}>{paint}</GoogleOverlayFrame>)
  expect(screen.getByTestId('scale')).toHaveTextContent('1')
  const paints = paint.mock.calls.length
  act(() => sdk.frame!.draw())
  expect(paint).toHaveBeenCalledTimes(paints)
  for (const width of [0, NaN, Infinity]) {
    sdk.width = width
    act(() => sdk.frame!.draw())
    expect(screen.getByTestId('scale')).toHaveTextContent('1')
  }
  const frame = sdk.frame!
  view.unmount()
  expect(frame.setMap).toHaveBeenLastCalledWith(null)
})

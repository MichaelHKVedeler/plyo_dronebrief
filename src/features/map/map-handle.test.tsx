import { createRef, useImperativeHandle } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MapHandle } from './map-handle'

const sdk = vi.hoisted(() => ({ props: {} as Record<string, unknown>, visual: {} as Record<string, unknown>, marker: { position: {} } }))
vi.mock('@vis.gl/react-google-maps', () => ({ Polygon: () => null,
  AdvancedMarker: (props: Record<string, unknown>) => {
    if (props.onDrag) sdk.props = props
    else sdk.visual = props
    useImperativeHandle(props.ref as ReturnType<typeof createRef>, () => sdk.marker)
    return null
  },
}))
afterEach(cleanup)
it('keeps the SDK marker constrained on every drag event, including at the limit', () => {
  const preview = vi.fn()
  const commit = vi.fn()
  const locked = { lat: 60, lng: 11 }
  render(<MapHandle position={locked} label="Oval" constrain={() => locked}
    onStart={vi.fn()} onPreview={preview} onCommit={commit} onEnter={vi.fn()} onLeave={vi.fn()}>Oval</MapHandle>)
  expect(sdk.visual.position).toEqual(locked)
  expect(sdk.visual.draggable).toBe(false)
  expect(sdk.props.style).toMatchObject({ opacity: 0 })
  const event = { latLng: { toJSON: () => ({ lat: 62, lng: 15 }) } }
  const drag = sdk.props.onDrag as (event: unknown) => void
  drag(event)
  expect(sdk.marker.position).toEqual(locked)
  expect(preview).toHaveBeenLastCalledWith(locked)
  sdk.marker.position = { lat: 64, lng: 20 }
  drag(event)
  expect(sdk.marker.position).toEqual(locked)
  const end = sdk.props.onDragEnd as (event: unknown) => void
  end(event)
  expect(commit).toHaveBeenCalledWith(locked)
})

import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraMarker } from './camera-marker'
import { destination, distanceMeters, metersPerPixel } from './geometry'
import { MapObjectScale, mapObjectScale } from './map-object-scale'
import type { Position } from '@/features/briefs/model/brief'
import type { ObjectMarkerProps } from './object-renderer'
const sdk = vi.hoisted(() => ({ dragStart: () => {}, markers: new Map<string, ObjectMarkerProps>() }))
vi.mock('@vis.gl/react-google-maps', () => ({ Polygon: () => null, AdvancedMarker: (props: ObjectMarkerProps & { children: ReactNode }) => {
  sdk.dragStart = () => props.onDragStart?.({} as google.maps.MapMouseEvent)
  if (props.title) sdk.markers.set(props.title, props)
  return <div>{props.children}</div>
} }))
afterEach(cleanup)
it.each([true, false])('keeps arrows fixed on the ground while zooming without saving (editable: %s)', (editable) => {
  const angle = { id: 'a', label: 'A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 45 }
  const commit = vi.fn()
  const scene = (zoom: number) => <MapObjectScale value={mapObjectScale(zoom)}>
    <CameraMarker angle={angle} editable={editable} selected={false} pixelsToMeters={metersPerPixel(angle.position.lat, zoom)}
      dslrSettings={{ heightsMeters: [1.6], angleCount: 3, spacingDegrees: 35 }} onSelect={vi.fn()} onCommit={commit} />
  </MapObjectScale>
  const view = render(scene(17))
  const names = [1, 2, 3].map((number) => 'Aim DSLR 1 angle ' + number)
  const initial = names.map((name) => sdk.markers.get(name)!.position as Position)
  for (const zoom of [16, 14.5, 10, 18.25]) {
    view.rerender(scene(zoom))
    names.forEach((name, index) => {
      const arrow = sdk.markers.get(name)!
      expect(distanceMeters(initial[index], arrow.position as Position)).toBeLessThan(0.001)
      expect(arrow.draggable).toBe(editable)
    })
    expect(sdk.markers.get('DSLR 1')!.position).toEqual(angle.position)
  }
  expect(commit).not.toHaveBeenCalled()
})

it('preserves the group when a modifier click becomes a small drag', () => {
 const select = vi.fn()
 render(<CameraMarker angle={{ id: 'a', label: 'A', type: '360', position: { lat: 60, lng: 10 } }} editable selected={false} pixelsToMeters={1} onSelect={select} onCommit={vi.fn()} />)
 const button = screen.getByRole('button', { name: 'Move 360 1' })
 fireEvent.click(button, { ctrlKey: true })
 expect(select).toHaveBeenLastCalledWith(true)
 sdk.dragStart()
 expect(select).toHaveBeenLastCalledWith(true)
 fireEvent.click(button, { shiftKey: true })
 expect(select).toHaveBeenLastCalledWith(true)
 fireEvent.click(button)
 expect(select).toHaveBeenLastCalledWith(false)
})

it('updates every DSLR fan and rotates it by dragging any arrow, preserving spacing and the point position', () => {
  const angle = { id: 'a', label: 'DSLR A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 0 }
  const commit = vi.fn()
  const props = { angle, editable: true, selected: false, pixelsToMeters: 1, onSelect: vi.fn(), onCommit: commit }
  const view = render(<CameraMarker {...props} dslrSettings={{ heightsMeters: [1.6], angleCount: 1, spacingDegrees: 30 }} />)
  expect(screen.getByRole('button', { name: 'Aim DSLR 1' })).toBeInTheDocument()
  view.rerender(<CameraMarker {...props} dslrSettings={{ heightsMeters: [1.6], angleCount: 3, spacingDegrees: 30 }} />)
  expect(screen.getAllByRole('button', { name: /Aim DSLR 1 angle/ })).toHaveLength(3)
  const point = destination(angle.position, 100, 90)
  sdk.markers.get('Aim DSLR 1 angle 3')!.onDragEnd!({ latLng: { toJSON: () => point } } as google.maps.MapMouseEvent)
  expect(commit.mock.lastCall?.[0].directionDegrees).toBeCloseTo(60, 5)
  expect(commit.mock.lastCall?.[0].position).toEqual(angle.position)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Aim DSLR 1 angle 1' }), { key: 'ArrowRight' })
  expect(commit.mock.lastCall?.[0].directionDegrees).toBe(5)
})

it('shows a camera number while keeping all read-only arrows visible', () => {
  const angle = { id: 'a', label: 'DSLR A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 0 }
  const commit = vi.fn()
  render(<CameraMarker angle={angle} editable={false} selected={false} pixelsToMeters={1} number={7}
    dslrSettings={{ heightsMeters: [1.6], angleCount: 4, spacingDegrees: 90 }} onSelect={vi.fn()} onCommit={commit} />)
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.queryByText('DSLR A')).not.toBeInTheDocument()
  for (const arrow of screen.getAllByRole('button', { name: /Aim DSLR 7 angle/ })) {
    expect(arrow).toBeDisabled()
    fireEvent.keyDown(arrow, { key: 'ArrowRight' })
  }
  expect(commit).not.toHaveBeenCalled()
})

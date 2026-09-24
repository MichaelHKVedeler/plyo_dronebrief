import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraMarker } from './camera-marker'
import { destination, distanceMeters, metersPerPixel } from './geometry'
import { MapObjectScale, mapObjectScale } from './map-object-scale'
import type { Position } from '@/features/briefs/model/brief'
import type { ObjectMarkerProps } from './object-renderer'
const sdk = vi.hoisted(() => ({ dragStart: (_event?: Partial<google.maps.MapMouseEvent>) => {}, markers: new Map<string, ObjectMarkerProps>() }))
vi.mock('@vis.gl/react-google-maps', () => ({ Polygon: () => null, AdvancedMarker: (props: ObjectMarkerProps & { children: ReactNode }) => {
  if (props.draggable) sdk.dragStart = (event?: Partial<google.maps.MapMouseEvent>) => props.onDragStart?.(event as google.maps.MapMouseEvent)
  if (props.title) sdk.markers.set(props.title, props)
  return <div>{props.children}</div>
} }))
afterEach(() => {
  cleanup()
  sdk.markers.clear()
})
it('hides camera geometry and handles at zero size and restores them at normal size without saving', () => {
  const commit = vi.fn()
  const camera = <CameraMarker angle={{ id: 'a', label: 'A', type: '360', position: { lat: 60, lng: 10 }, focus: { directionDegrees: 90, fovDegrees: 60 } }}
    editable selected pixelsToMeters={1} onSelect={vi.fn()} onCommit={commit} />
  const view = render(<MapObjectScale value={0}>{camera}</MapObjectScale>)
  expect(view.container).toBeEmptyDOMElement()
  view.rerender(<MapObjectScale value={1}>{camera}</MapObjectScale>)
  expect(screen.getByRole('button', { name: 'Move 360 1' })).toBeVisible()
  expect(view.container.querySelector('[data-panorama-focus]')).toBeTruthy()
  expect(commit).not.toHaveBeenCalled()
})
it.each([true, false])('keeps arrows fixed on the ground while zooming without saving (editable: %s)', (editable) => {
  const angle = { id: 'a', label: 'A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 45 }
  const commit = vi.fn()
  const scene = (zoom: number) => <MapObjectScale value={mapObjectScale(zoom)}>
    <CameraMarker angle={angle} editable={editable} selected pixelsToMeters={metersPerPixel(angle.position.lat, zoom)}
      dslrSettings={{ heightsMeters: [1.6], angleCount: 3, spacingDegrees: 35 }} onSelect={vi.fn()} onCommit={commit} />
  </MapObjectScale>
  const view = render(scene(17))
  if (editable) fireEvent.mouseEnter(screen.getByRole('button', { name: 'Move DSLR 1' }))
  const names = [1, 2, 3].map((number) => 'Aim DSLR 1 angle ' + number)
  const arrows = () => editable ? names.map((name) => sdk.markers.get(name)!.position as Position) : []
  const initial = arrows()
  const visuals = () => [...view.container.querySelectorAll('[data-camera-arrow]')].map((node) => (node as HTMLElement).style.transform)
  const initialVisuals = visuals()
  for (const zoom of [16, 14.5, 10, 18.25]) {
    view.rerender(scene(zoom))
    if (editable) fireEvent.mouseEnter(screen.getByRole('button', { name: 'Move DSLR 1' }))
    names.forEach((name, index) => {
      if (!editable) return
      const arrow = sdk.markers.get(name)!
      expect(distanceMeters(initial[index], arrow.position as Position)).toBeLessThan(0.001)
      expect(arrow.draggable).toBe(true)
    })
    expect(visuals()).toEqual(initialVisuals)
    expect(sdk.markers.get('DSLR 1')!.position).toEqual(angle.position)
  }
  expect(commit).not.toHaveBeenCalled()
})

it('selects a read-only briefing point without moving it', () => {
  const select = vi.fn()
  render(<CameraMarker angle={{ id: 'a', label: 'A', type: '360', position: { lat: 60, lng: 10 }, heightsMeters: [11] }}
    editable={false} selectable selected={false} pixelsToMeters={1} onSelect={select} onCommit={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '360 1' }))
  expect(select).toHaveBeenCalledExactlyOnceWith(false)
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
  const props = { angle, editable: true, selected: true, pixelsToMeters: 1, onSelect: vi.fn(), onCommit: commit }
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

it('shows direction arrows without extra map markers until the camera is hovered', () => {
  const angle = { id: 'a', label: 'A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 0 }
  const { container } = render(<CameraMarker angle={angle} editable selected={false} pixelsToMeters={1}
    dslrSettings={{ heightsMeters: [1.6], angleCount: 3, spacingDegrees: 30 }} onSelect={vi.fn()} onCommit={vi.fn()} />)
  expect(container.querySelectorAll('[data-camera-arrow]')).toHaveLength(3)
  expect(sdk.markers.has('Aim DSLR 1 angle 1')).toBe(false)
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Move DSLR 1' }))
  expect(sdk.markers.has('Aim DSLR 1 angle 1')).toBe(true)
  expect(sdk.markers.has('Aim DSLR 1 angle 2')).toBe(true)
  expect(sdk.markers.has('Aim DSLR 1 angle 3')).toBe(true)
})

it('alt-drags a copy and leaves the original unmoved', () => {
  const commit = vi.fn()
  const duplicate = vi.fn()
  const select = vi.fn()
  const angle = { id: 'a', label: 'A', type: '360' as const, position: { lat: 60, lng: 10 } }
  const point = { lat: 61, lng: 11 }
  render(<CameraMarker angle={angle} editable selected={false} pixelsToMeters={1} duplicateNumber={2}
    onSelect={select} onCommit={commit} onDuplicate={duplicate} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Move 360 1' }), { button: 0, altKey: true })
  act(() => { sdk.dragStart({ domEvent: { altKey: true } as MouseEvent }) })
  const event = { latLng: { toJSON: () => point } } as google.maps.MapMouseEvent
  const marker = sdk.markers.get('360 2')!
  act(() => { marker.onDrag!(event); marker.onDragEnd!(event) })
  expect(duplicate).toHaveBeenCalledExactlyOnceWith(point)
  expect(commit).not.toHaveBeenCalled()
  expect(select).not.toHaveBeenCalled()
})

it('shows a camera number while keeping all read-only arrows visible', () => {
  const angle = { id: 'a', label: 'DSLR A', type: 'dslr' as const, position: { lat: 60, lng: 10 }, directionDegrees: 0 }
  const commit = vi.fn()
  const { container } = render(<CameraMarker angle={angle} editable={false} selected={false} pixelsToMeters={1} number={7}
    dslrSettings={{ heightsMeters: [1.6], angleCount: 4, spacingDegrees: 90 }} onSelect={vi.fn()} onCommit={commit} />)
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.queryByText('DSLR A')).not.toBeInTheDocument()
  expect(container.querySelector('[data-camera-marker] svg')).toHaveClass('size-5')
  expect(container.querySelector('[data-slot=badge][data-camera-badge]')).toBeTruthy()
  expect(container.querySelector('[data-camera-marker] [data-slot=badge]:not([data-camera-badge])')).toBeNull()
  expect(container.querySelectorAll('[data-camera-arrow]')).toHaveLength(4)
  expect(screen.queryByRole('button', { name: /Aim DSLR 7/ })).not.toBeInTheDocument()
  expect(commit).not.toHaveBeenCalled()
})

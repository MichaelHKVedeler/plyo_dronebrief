import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraMarker } from './camera-marker'
import { cameraLabels, type CameraAngle } from '@/features/briefs/model/brief'
import { ShadeProjection } from './shade-projection'
import { ObjectRenderer } from './object-renderer'
import { ShadeMarker, ShadePolygon } from './shade-object-renderer'
import type { Map as LibreMap } from 'maplibre-gl'

vi.mock('@vis.gl/react-google-maps', () => ({ Polygon: () => null, AdvancedMarker: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
beforeAll(() => vi.stubGlobal('PointerEvent', class extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const angle = { id: 'p', label: 'Panorama', type: '360', position: { lat: 59.9, lng: 10.7 } } satisfies CameraAngle
function setup({ editable = true, interactive = true, shade = false, focused = false, type = '360' as CameraAngle['type'] } = {}) {
  const commit = vi.fn(), select = vi.fn()
  const point: CameraAngle = type !== '360' ? { ...angle, type, directionDegrees: 45 } : focused ? { ...angle, focus: { directionDegrees: 45, fovDegrees: 90 } } : angle
  const marker = <CameraMarker angle={point} editable={editable} interactive={interactive} selected={false} pixelsToMeters={1} onSelect={select} onCommit={commit}
    dslrSettings={{ heightsMeters: [1.6], angleCount: 3, spacingDegrees: 30 }} />
  const map = { project: () => ({ x: 200, y: 200 }), on: vi.fn(), off: vi.fn() } as unknown as LibreMap
  const view = render(shade ? <ShadeProjection value={map}><ObjectRenderer value={{ Marker: ShadeMarker, Polygon: ShadePolygon }}>{marker}</ObjectRenderer></ShadeProjection> : marker)
  const button = screen.queryByRole('button', { name: 'Move ' + cameraLabels[type] + ' 1' })
  if (button) vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 182, top: 182, width: 36, height: 36 } as DOMRect)
  const down = (buttonNumber = 2) => fireEvent.pointerDown(button!, { button: buttonNumber, buttons: buttonNumber === 2 ? 2 : 1, clientX: 200, clientY: 200, pointerId: 1 })
  const move = (x: number, y: number, pointerId = 1) => fireEvent.pointerMove(window, { buttons: 2, clientX: x, clientY: y, pointerId })
  const up = (x: number, y: number) => fireEvent.pointerUp(window, { button: 2, clientX: x, clientY: y, pointerId: 1 })
  const cone = () => view.container.querySelector('[data-panorama-focus]')?.getAttribute('aria-label')
  return { ...view, point, button, commit, select, down, move, up, cone }
}

describe.each(['dslr', 'drone-image'] as const)('%s direction aiming', (type) => {
it.each([false, true])('right-drags a bearing without moving the camera or adding an FOV (ShadeMap: %s)', (shade) => {
  const { down, move, up, commit, cone, point, container } = setup({ type, shade })
  const arrows = () => [...container.querySelectorAll<HTMLElement>('[data-camera-arrow]')].map((node) => node.style.transform)
  const originalArrows = arrows()
  down(); move(260, 200)
  const east = arrows()
  expect(east).toHaveLength(type === 'dslr' ? 3 : 1)
  expect(east).not.toEqual(originalArrows)
  move(380, 200)
  expect(arrows()).toEqual(east)
  expect(cone()).toBeUndefined()
  expect(commit).not.toHaveBeenCalled()
  up(80, 200)
  expect(commit).toHaveBeenCalledExactlyOnceWith({ ...point, directionDegrees: 270 })
  expect(commit.mock.calls[0][0]).not.toHaveProperty('focus')
})

it.each(['Escape', 'pointercancel', 'blur', 'lostpointercapture'])('discards right-drag direction previews on %s', (eventType) => {
  const { button, down, move, up, commit, container } = setup({ type })
  const arrows = () => [...container.querySelectorAll<HTMLElement>('[data-camera-arrow]')].map((node) => node.style.transform)
  const originalArrows = arrows()
  down(); move(280, 200)
  expect(arrows()).not.toEqual(originalArrows)
  if (eventType === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  else fireEvent(eventType === 'lostpointercapture' ? button! : window, new Event(eventType))
  up(280, 200)
  expect(arrows()).toEqual(originalArrows)
  expect(commit).not.toHaveBeenCalled()
})

it('does not edit direction for a stationary right-click or during placement/viewing', () => {
  const single = setup({ type })
  single.down(); single.up(200, 200)
  expect(single.commit).not.toHaveBeenCalled()
  single.unmount()
  const inactive = setup({ type, interactive: false })
  inactive.down(); inactive.move(320, 200); inactive.up(320, 200)
  expect(inactive.commit).not.toHaveBeenCalled()
  inactive.unmount()
  const viewer = setup({ type, editable: false })
  expect(viewer.button).toBeNull()
  expect(viewer.container.querySelectorAll('[data-camera-arrow]')).toHaveLength(type === 'dslr' ? 3 : 1)
  expect(viewer.cone()).toBeUndefined()
})
})

it.each([false, true])('widens and rotates a 360 focus in a live preview, saving once on release (ShadeMap: %s)', (shade) => {
  const { down, move, up, commit, cone } = setup({ shade })
  down(); move(260, 200)
  expect(cone()).toContain('60° field of view, heading 90°')
  move(320, 200)
  expect(cone()).toContain('120° field of view, heading 90°')
  move(200, 80)
  expect(cone()).toContain('120° field of view, heading 0°')
  expect(commit).not.toHaveBeenCalled()
  up(80, 200)
  expect(commit).toHaveBeenCalledExactlyOnceWith({ ...angle, focus: { directionDegrees: 270, fovDegrees: 120 } })
})

it.each(['Escape', 'pointercancel', 'blur', 'lostpointercapture'])('restores an existing focus without saving on %s', (type) => {
  const { button, down, move, up, cone, commit } = setup({ focused: true })
  down(); move(200, 0)
  expect(cone()).toContain('180° field of view')
  if (type === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  else fireEvent(type === 'lostpointercapture' ? button! : window, new Event(type))
  up(200, 0)
  expect(cone()).toContain('90° field of view, heading 45°')
  expect(commit).not.toHaveBeenCalled()
})

it('ignores other pointers, avoids a right-click-only edit, and keeps normal map events available afterwards', () => {
  const { down, move, up, commit } = setup()
  down(); move(300, 200, 2); up(200, 200)
  expect(commit).not.toHaveBeenCalled()
  expect(fireEvent.contextMenu(window)).toBe(false)
  fireEvent.pointerDown(document.body, { button: 0 })
  expect(fireEvent.contextMenu(document.body)).toBe(true)
})

it('clamps the width near the point and preserves bearing when returning exactly to its center', () => {
  const { down, move, up, cone, commit } = setup()
  down(); move(140, 200); move(200, 200)
  expect(cone()).toContain('10° field of view, heading 270°')
  up(200, 200)
  expect(commit).toHaveBeenCalledExactlyOnceWith({ ...angle, focus: { directionDegrees: 270, fovDegrees: 10 } })
})

it('shows saved focus in the viewer and disables focus gestures during placement', () => {
  const viewer = setup({ editable: false, focused: true })
  expect(viewer.button).toBeNull()
  expect(viewer.cone()).toContain('90° field of view, heading 45°')
  viewer.unmount()
  const inactive = setup({ interactive: false })
  inactive.down(); inactive.move(320, 200); inactive.up(320, 200)
  expect(inactive.commit).not.toHaveBeenCalled()
  expect(inactive.cone()).toBeUndefined()
})

it('removes active drag handlers on unmount', () => {
  const { down, move, up, commit, unmount } = setup()
  down(); move(320, 200); unmount(); up(320, 200)
  expect(commit).not.toHaveBeenCalled()
  expect(fireEvent.contextMenu(document.body)).toBe(true)
})

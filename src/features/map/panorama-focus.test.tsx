import type { ReactNode } from 'react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraMarker } from './camera-marker'
import type { CameraAngle } from '@/features/briefs/model/brief'
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
const angle: CameraAngle = { id: 'p', label: 'Panorama', type: '360', position: { lat: 59.9, lng: 10.7 } }
function setup({ editable = true, interactive = true, shade = false, focused = false } = {}) {
  const commit = vi.fn(), select = vi.fn()
  const point = focused ? { ...angle, focus: { directionDegrees: 45, fovDegrees: 90 } } : angle
  const marker = <CameraMarker angle={point} editable={editable} interactive={interactive} selected={false} pixelsToMeters={1} onSelect={select} onCommit={commit} />
  const map = { project: () => ({ x: 200, y: 200 }), on: vi.fn(), off: vi.fn() } as unknown as LibreMap
  const view = render(shade ? <ShadeProjection value={map}><ObjectRenderer value={{ Marker: ShadeMarker, Polygon: ShadePolygon }}>{marker}</ObjectRenderer></ShadeProjection> : marker)
  const button = screen.queryByRole('button', { name: 'Move 360 1' })
  if (button) vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 182, top: 182, width: 36, height: 36 } as DOMRect)
  const down = (buttonNumber = 2) => fireEvent.pointerDown(button!, { button: buttonNumber, buttons: buttonNumber === 2 ? 2 : 1, clientX: 200, clientY: 200, pointerId: 1 })
  const move = (x: number, y: number, pointerId = 1) => fireEvent.pointerMove(window, { buttons: 2, clientX: x, clientY: y, pointerId })
  const up = (x: number, y: number) => fireEvent.pointerUp(window, { button: 2, clientX: x, clientY: y, pointerId: 1 })
  const cone = () => view.container.querySelector('[data-panorama-focus]')?.getAttribute('aria-label')
  return { ...view, button, commit, select, down, move, up, cone }
}

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

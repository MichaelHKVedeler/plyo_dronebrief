import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CameraMarker } from './camera-marker'
const sdk = vi.hoisted(() => ({ dragStart: () => {} }))
vi.mock('@vis.gl/react-google-maps', () => ({ Polygon: () => null, AdvancedMarker: ({ children, onDragStart }: { children: ReactNode; onDragStart: () => void }) => { sdk.dragStart = onDragStart; return <div>{children}</div> } }))
afterEach(cleanup)
it('preserves the group when a modifier click becomes a small drag', () => {
 const select = vi.fn()
 render(<CameraMarker angle={{ id: 'a', label: 'A', type: '360', position: { lat: 60, lng: 10 } }} editable selected={false} pixelsToMeters={1} onSelect={select} onCommit={vi.fn()} />)
 const button = screen.getByRole('button', { name: 'Move A' })
 fireEvent.click(button, { ctrlKey: true })
 expect(select).toHaveBeenLastCalledWith(true)
 sdk.dragStart()
 expect(select).toHaveBeenLastCalledWith(true)
 fireEvent.click(button, { shiftKey: true })
 expect(select).toHaveBeenLastCalledWith(true)
 fireEvent.click(button)
 expect(select).toHaveBeenLastCalledWith(false)
})

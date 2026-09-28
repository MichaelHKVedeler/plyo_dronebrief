import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { DroneScanControls } from './drone-scan-controls'
import { DroneScanEditing } from '../state/drone-scan-editing'
import { openSession, reduceSession } from '../state/brief-session'
import { createBrief } from '../model/brief'

afterEach(cleanup)
const makeBrief = () => createBrief({ name: 'Scan', clientName: 'Test', date: '2026-09-26', times: ['09:00'] })

it('toggles linked movement without saving and centers through the update boundary', () => {
  const brief = makeBrief()
  brief.droneScan = { id: 'scan', highRes: { id: 'high', position: { lat: 59.914, lng: 10.7522 }, radiusMeters: 20 }, lowRes: { id: 'low', position: brief.coordinates, radiusMeters: 100 } }
  let current = openSession(brief, 'edit')
  const update = vi.fn()
  function Editor() {
    const [session, setSession] = useState(current)
    const [locked, setLocked] = useState(false)
    return <DroneScanEditing value={{ locked, setLocked }}><DroneScanControls brief={session.brief} editing onAdd={() => {}} onUpdate={(fn) => {
      update()
      current = reduceSession(session, { type: 'update', update: fn })
      setSession(current)
    }} /></DroneScanEditing>
  }
  render(<Editor />)
  const removeHigh = screen.getByRole('button', { name: 'Remove High Detail' })
  const removeLow = screen.getByRole('button', { name: 'Remove Low Detail' })
  expect(removeHigh).toHaveTextContent('High Detail')
  expect(removeHigh).not.toHaveTextContent('Remove')
  expect(removeHigh).toHaveClass('justify-start', 'border-blue-700', 'bg-blue-50', 'dark:bg-blue-950')
  expect(removeLow).toHaveClass('justify-start', 'border-red-700', 'bg-red-50', 'dark:bg-red-950')
  expect(removeHigh.querySelector('svg')).toHaveClass('text-red-600', 'dark:text-red-400')
  expect(removeLow.querySelector('svg')).toHaveClass('text-red-600', 'dark:text-red-400')
  fireEvent.click(screen.getByRole('button', { name: 'Lock drone scan circles together' }))
  expect(screen.getByRole('button', { name: 'Lock drone scan circles together' })).toHaveAttribute('aria-pressed', 'true')
  expect(update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Center drone scan circles' }))
  expect(update).toHaveBeenCalledOnce()
  expect(current.brief.droneScan!.highRes!.position).toEqual(brief.coordinates)
  expect(current.brief.droneScan!.highRes!.radiusMeters).toBe(20)
  expect(reduceSession(openSession(brief, 'view'), { type: 'update', update: () => current.brief }).brief).toEqual(brief)
})

it('disables pair actions until both circles exist and hides them in the viewer', () => {
  const brief = makeBrief()
  const onUpdate = vi.fn()
  const { rerender } = render(<DroneScanControls brief={brief} editing onAdd={() => {}} onUpdate={onUpdate} />)
  expect(screen.getByRole('button', { name: 'High Detail' })).toHaveClass('border-blue-700', 'bg-blue-50', 'dark:bg-blue-950')
  expect(screen.getByRole('button', { name: 'Low Detail' })).toHaveClass('border-red-700', 'bg-red-50', 'dark:bg-red-950')
  expect(screen.getByRole('button', { name: 'Lock drone scan circles together' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Center drone scan circles' })).toBeDisabled()
  rerender(<DroneScanControls brief={brief} editing={false} onAdd={() => {}} onUpdate={onUpdate} />)
  expect(screen.getByText('No drone scan in this brief.')).toBeVisible()
  expect(screen.queryByRole('button')).toBeNull()
  expect(onUpdate).not.toHaveBeenCalled()
})

it('snaps typed diameters to 100 m and warns above 500 m High Detail or 800 m Low Detail', () => {
  const brief = makeBrief()
  brief.droneScan = { id: 'scan', highRes: { id: 'high', position: brief.coordinates, radiusMeters: 250 }, lowRes: { id: 'low', position: brief.coordinates, radiusMeters: 400 } }
  let current = openSession(brief, 'edit')
  function Editor() {
    const [session, setSession] = useState(current)
    return <DroneScanControls brief={session.brief} editing onAdd={() => {}} onUpdate={(fn) => {
      current = reduceSession(session, { type: 'update', update: fn })
      setSession(current)
    }} />
  }
  render(<Editor />)
  expect(screen.queryByRole('alert')).toBeNull()
  const low = screen.getByLabelText('Low Detail diameter (m)')
  expect(low).toHaveAttribute('step', '100')
  expect(low).toHaveAttribute('min', '600')
  fireEvent.change(low, { target: { value: '860' } })
  expect(current.brief.droneScan!.lowRes!.radiusMeters * 2).toBe(900)
  expect(screen.getByRole('alert')).toHaveTextContent('Low Detail is over 800 m diameter.')
  fireEvent.change(screen.getByLabelText('High Detail diameter (m)'), { target: { value: '600' } })
  expect(current.brief.droneScan!.highRes!.radiusMeters * 2).toBe(600)
  expect(screen.getByRole('alert')).toHaveTextContent('High Detail is over 500 m diameter.')
})

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { BriefPage } from '@/pages/brief-page'
import { createBrief, type Position } from '@/features/briefs/model/brief'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'

const view = vi.hoisted(() => ({ change: (_center: Position) => {} }))
vi.mock('@/features/map/map-panel', () => ({ MapPanel: ({ onViewCenterChange }: { onViewCenterChange: (center: Position) => void }) => { view.change = onViewCenterChange; return null } }))
afterEach(cleanup)
it('places a new rig at the current view center without changing the legacy coordinates', () => {
  const brief = createBrief({ name: 'View center', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
  let current = openSession(brief, 'edit')
  function Editor() {
    const [session, setSession] = useState(current)
    useEffect(() => { current = session }, [session])
    return <BriefPage session={session} dispatch={(action) => setSession((value) => reduceSession(value, action))} error={null} />
  }
  render(<Editor />)
  view.change({ lat: 60.123456789, lng: 11.987654321 })
  const addRig = screen.getByRole('button', { name: 'Add Circle Rig' })
  expect(addRig).toHaveClass('border-emerald-700', 'bg-emerald-50', 'dark:bg-emerald-950')
  fireEvent.click(addRig)
  expect(current.brief.circleRig?.position).toEqual({ lat: 60.123456789, lng: 11.987654321 })
  expect(current.brief.circleRig?.arrowCount).toBe(8)
  expect(current.brief.coordinates).toEqual(brief.coordinates)
  expect(current.visibility.circleRig).toBe(true)
  const removeRig = screen.getByRole('button', { name: 'Remove Circle Rig' })
  expect(removeRig).toHaveTextContent('Circle Rig')
  expect(removeRig).not.toHaveTextContent('Remove')
  expect(removeRig).toHaveClass('justify-start', 'border-emerald-700', 'bg-emerald-50', 'dark:bg-emerald-950')
  expect(removeRig.querySelector('svg')).toHaveClass('text-red-600', 'dark:text-red-400')
})

it('shows the two oval radii in the read-only brief without exposing rig creation', () => {
  const brief = createBrief({ name: 'Oval', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
  brief.circleRig = { id: 'rig', position: brief.coordinates, arrowCount: 10, radiusMeters: 80, ovalRatio: 0.5, rotationDegrees: 30 }
  const dispatch = vi.fn()
  render(<BriefPage session={openSession(brief, 'view')} dispatch={dispatch} error={null} />)
  expect(screen.getByText('40.0 m')).toBeVisible()
  expect(screen.getByText('80.0 m')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Add Circle Rig' })).toBeNull()
  expect(dispatch).not.toHaveBeenCalled()
})

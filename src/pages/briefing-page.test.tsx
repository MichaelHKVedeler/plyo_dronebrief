import { afterEach, expect, it, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createBrief } from '@/features/briefs/model/brief'
import { openSession, reduceSession, type BriefSession } from '@/features/briefs/state/brief-session'
import { defaultBriefingPresentation } from '@/features/briefs/storage/public-brief-link'
import { BriefingPage } from './briefing-page'

afterEach(cleanup)
vi.mock('@/features/map/pdf-address', () => ({ lookupPdfAddress: vi.fn(async () => 'Auto street 1: Area') }))
vi.mock('@/features/map/map-panel', () => ({
  MapPanel: ({ layerControls, onSelectCamera, pointCallout, session, isolatedKind }: { layerControls?: ReactNode; onSelectCamera?: (id: string, additive: boolean) => void; pointCallout?: ReactNode; session: BriefSession; isolatedKind?: string | null }) => <div role="region" aria-label="Brief map">
    <button type="button" onClick={() => onSelectCamera?.('p1', false)}>Select 360 point</button>
    <button type="button" onClick={() => onSelectCamera?.('d1', false)}>Select drone point</button>
    <button type="button" onClick={() => onSelectCamera?.('extra', false)}>Select extra coverage</button>
    <p data-testid="map-content">{[session.brief.circleRig ? 'rig' : '', session.brief.droneScan ? 'scan' : '', ...session.brief.angles.map((angle) => angle.id), `isolated:${isolatedKind ?? 'none'}`].filter(Boolean).join(' ')}</p>
    {layerControls}
    {pointCallout}
  </div>,
}))

it('keeps the map in place and scrolls project details inside the information overlay', async () => {
  const brief = createBrief({ name: 'Cloud project', clientName: 'Client', date: '2026-05-16', times: ['09:00', '14:00'] })
  brief.project.description = 'A long property note.\n'.repeat(40)
  brief.angles = [{ id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 }]
  const user = userEvent.setup()
  render(<BriefingPage session={openSession(brief, 'view')} dispatch={() => {}} error={null} presentation={{ ...defaultBriefingPresentation, address: 'Karl Johans gate: Oslo' }} />)
  expect(screen.getByRole('region', { name: 'Brief map' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show only Aerial photo' })).toBeVisible()
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Map layers')).not.toBeInTheDocument()
  const info = screen.getByRole('button', { name: 'Project information' })
  expect(info).toHaveClass('absolute', 'bottom-8', 'left-3', 'lg:hidden')
  await user.click(info)
  const details = screen.getByLabelText('Brief details')
  expect(details).toBeVisible()
  expect(within(details).getByText('Dronebrief')).toBeVisible()
  expect(within(details).getByRole('heading', { name: 'Cloud project' })).toBeVisible()
  expect(within(details).getByText('Client')).toBeVisible()
  expect(within(details).getByText('Karl Johans gate: Oslo')).toBeVisible()
  expect(within(details).getByText('16. May 2026')).toBeVisible()
  expect(within(details).getByText('09:00')).toBeVisible()
  expect(within(details).getByText('14:00')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Brief map' })).toBeInTheDocument()
  expect(details.querySelector('[data-slot=scroll-area-viewport]')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Project information' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close project information' }))
  expect(screen.getByRole('button', { name: 'Project information' })).toBeVisible()
})

it('shows the clicked point heights, including a 360 override', async () => {
  const brief = createBrief({ name: 'Cloud project', clientName: 'Client', date: '2026-05-16', times: ['09:00'] })
  brief.angles = [
    { id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 20 },
    { id: 'p1', label: 'P1', type: '360', position: brief.coordinates, heightsMeters: [11, 14] },
  ]
  const user = userEvent.setup()
  render(<BriefingPage session={openSession(brief, 'view')} dispatch={() => {}} error={null} presentation={defaultBriefingPresentation} />)
  await user.click(screen.getByRole('button', { name: 'Select 360 point' }))
  const heights = screen.getByRole('status', { name: '360 1 Heights' })
  expect(heights).toHaveTextContent('11 m, 14 m')
  expect(heights).toHaveTextContent('Custom heights')
  expect(heights).not.toHaveTextContent('360 1')
  await user.click(screen.getByRole('button', { name: 'Select drone point' }))
  expect(screen.getByRole('status', { name: 'Drone image 1 Heights' })).toHaveTextContent('40 m, 60 m')
  await user.click(screen.getByRole('button', { name: 'Close point heights' }))
  expect(screen.queryByRole('status', { name: /Heights/ })).not.toBeInTheDocument()
})

it('hides the floorplan from the public map without writing the brief', async () => {
  const brief = createBrief({ name: 'Cloud project', clientName: 'Client', date: '2026-05-16', times: ['09:00'] })
  brief.angles = [{ id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 }]
  brief.imageOverlays = [{
    id: 'plan', name: 'Plan', source: 'data:image/png;base64,AAAA', position: brief.coordinates,
    widthMeters: 40, heightMeters: 30, rotationDegrees: 0, opacity: 0.7,
  }]
  const user = userEvent.setup()
  let current = openSession(brief, 'view')
  function Fixture() {
    const [session, setSession] = useState(current)
    useEffect(() => { current = session }, [session])
    return <BriefingPage session={session} dispatch={(action) => setSession((value) => reduceSession(value, action))} error={null} presentation={defaultBriefingPresentation} />
  }
  render(<Fixture />)
  const hide = screen.getByRole('button', { name: 'Hide floorplan' })
  expect(hide).toHaveAttribute('aria-pressed', 'true')
  await user.click(hide)
  expect(current.visibility.imageOverlays).toBe(false)
  expect(current.brief).toBe(brief)
  expect(screen.getByRole('button', { name: 'Show floorplan' })).toHaveAttribute('aria-pressed', 'false')
})

it('offers the scan switch for extra coverage alone and switches exclusively without saving', async () => {
  const brief = createBrief({ name: 'Extra coverage', clientName: 'Test' })
  brief.angles = [
    { id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: brief.coordinates },
    { id: 'd1', label: 'Drone image 1', type: 'drone-image', position: brief.coordinates, directionDegrees: 90 },
  ]
  const dispatch = vi.fn()
  const user = userEvent.setup()
  render(<BriefingPage session={openSession(brief, 'view')} dispatch={dispatch} error={null} presentation={defaultBriefingPresentation} />)
  const scan = screen.getByRole('button', { name: 'Show only Drone scan' })
  const drone = screen.getByRole('button', { name: 'Show only Aerial photo' })
  expect(scan).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Show only Extra coverage' })).not.toBeInTheDocument()
  await user.click(scan)
  expect(scan).toHaveAttribute('aria-pressed', 'true')
  expect(drone).toHaveAttribute('aria-pressed', 'false')
  await user.click(drone)
  expect(scan).toHaveAttribute('aria-pressed', 'false')
  expect(drone).toHaveAttribute('aria-pressed', 'true')
  await user.click(scan)
  await user.click(scan)
  expect(scan).toHaveAttribute('aria-pressed', 'false')
  expect(drone).toHaveAttribute('aria-pressed', 'false')
  expect(dispatch).not.toHaveBeenCalled()
})

function splitBrief() {
  const brief = createBrief({ name: 'Split', clientName: 'Test', date: '2026-05-16', times: ['09:00'] })
  brief.circleRig = { id: 'rig', position: brief.coordinates, radiusMeters: 30, arrowCount: 8, ovalRatio: 1, rotationDegrees: 0 }
  brief.droneScan = { id: 'scan', highRes: { id: 'high', position: brief.coordinates, radiusMeters: 250 }, lowRes: { id: 'low', position: brief.coordinates, radiusMeters: 400 } }
  brief.angles = [
    { id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: brief.coordinates },
    { id: 'd1', label: 'Drone image 1', type: 'drone-image', position: brief.coordinates, directionDegrees: 90 },
  ]
  return brief
}

it('shows only photo content in a photo brief link', () => {
  const brief = splitBrief()
  render(<BriefingPage session={openSession(brief, 'view')} dispatch={() => {}} error={null} presentation={{ ...defaultBriefingPresentation, content: 'photo' }} />)
  expect(screen.getByTestId('map-content')).toHaveTextContent(/^rig d1 isolated:none$/)
  expect(screen.queryByRole('button', { name: 'Show only Drone scan' })).not.toBeInTheDocument()
  expect(within(screen.getByLabelText('Brief details')).queryByText('Extra coverage', { exact: false })).not.toBeInTheDocument()
})

it('shows only the drone scan in a scan link with separate circle and extra coverage isolation, without shoot times or heights', async () => {
  const brief = splitBrief()
  const user = userEvent.setup()
  render(<BriefingPage session={openSession(brief, 'view')} dispatch={() => {}} error={null} presentation={{ ...defaultBriefingPresentation, content: 'scan' }} />)
  expect(screen.getByTestId('map-content')).toHaveTextContent(/^scan extra isolated:droneScan$/)
  const circles = screen.getByRole('button', { name: 'Show only Drone scan' })
  const extra = screen.getByRole('button', { name: 'Show only Extra coverage' })
  await user.click(circles)
  expect(circles).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('map-content')).toHaveTextContent(/isolated:scanCircles$/)
  await user.click(extra)
  expect(extra).toHaveAttribute('aria-pressed', 'true')
  expect(circles).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByTestId('map-content')).toHaveTextContent(/isolated:extra-coverage$/)
  await user.click(extra)
  expect(screen.getByTestId('map-content')).toHaveTextContent(/isolated:droneScan$/)
  const details = screen.getByLabelText('Brief details')
  expect(within(details).getByText('High detail: 500 m diameter')).toBeInTheDocument()
  expect(within(details).getByText('Low detail: 800 m diameter')).toBeInTheDocument()
  expect(within(details).queryByText('Total images')).not.toBeInTheDocument()
  expect(within(details).queryByText('Shoot times')).not.toBeInTheDocument()
  expect(within(details).queryByText('09:00')).not.toBeInTheDocument()
  expect(within(details).queryByText(/project$/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Select extra coverage' }))
  expect(screen.queryByRole('status', { name: /Heights/ })).not.toBeInTheDocument()
})

it('looks up the address when a split link leaves it out', async () => {
  render(<BriefingPage session={openSession(splitBrief(), 'view')} dispatch={() => {}} error={null} presentation={{ ...defaultBriefingPresentation, content: 'photo', address: null }} />)
  expect(await within(screen.getByLabelText('Brief details')).findByText('Auto street 1: Area')).toBeInTheDocument()
})

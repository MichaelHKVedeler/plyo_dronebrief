import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createBrief } from '@/features/briefs/model/brief'
import { openSession } from '@/features/briefs/state/brief-session'
import { defaultBriefingPresentation } from '@/features/briefs/storage/public-brief-link'
import { BriefingPage } from './briefing-page'

vi.mock('@/features/map/map-panel', () => ({
  MapPanel: ({ layerControls }: { layerControls?: ReactNode }) => <div role="region" aria-label="Brief map">{layerControls}</div>,
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
  await user.click(screen.getByRole('button', { name: 'Project information' }))
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

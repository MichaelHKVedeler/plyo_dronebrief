import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '../model/brief'
import { BriefingMapLayers } from './briefing-map-layers'
import { CaptureInstructionsList } from './capture-instructions-list'

function captureBrief() {
  const brief = createBrief({ name: 'Capture', clientName: 'Client' })
  brief.angles = [
    { id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 },
    { id: 's1', label: 'S1', type: 'dslr', position: brief.coordinates, directionDegrees: 90 },
  ]
  return brief
}

it('keeps description icons at full opacity while dimming other copy on wide screens', () => {
  const brief = captureBrief()
  render(<CaptureInstructionsList brief={brief} language="en" isolatedKind="drone-image" />)
  expect(screen.queryByRole('button', { name: 'Show only Aerial photo' })).not.toBeInTheDocument()
  const aerial = screen.getByText('Aerial photo', { exact: false }).closest('li')
  const dslr = screen.getByText('DSLR', { exact: false }).closest('li')
  expect(aerial).not.toHaveClass('opacity-50')
  expect(dslr).not.toHaveClass('opacity-50')
  expect(screen.getByText('Aerial photo', { exact: false })).not.toHaveClass('lg:opacity-50')
  expect(screen.getByText('DSLR', { exact: false })).toHaveClass('lg:opacity-50')
  expect(screen.queryByLabelText('Aerial photo count')).not.toBeInTheDocument()
  expect(screen.getByText('Point 1: 40m, 60m')).toBeVisible()
  expect(screen.getByText('Point 1: Ground-level')).toBeVisible()
})

it('isolates a capture type from the map overlay and restores all types on a second click', async () => {
  const onIsolate = vi.fn()
  const user = userEvent.setup()
  const view = render(<BriefingMapLayers brief={captureBrief()} language="en" isolatedKind={null} onIsolate={onIsolate} />)
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenCalledWith('drone-image')
  view.rerender(<BriefingMapLayers brief={captureBrief()} language="en" isolatedKind="drone-image" onIsolate={onIsolate} />)
  expect(screen.getByRole('button', { name: 'Show only Aerial photo' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenLastCalledWith(null)
})

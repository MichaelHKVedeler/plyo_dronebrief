import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '../model/brief'
import { BriefingMapLayers } from './briefing-map-layers'
import { CaptureInstructionsList } from './capture-instructions-list'

function captureBrief() {
  const brief = createBrief({ name: 'Capture', clientName: 'Client' })
  brief.circleRig = { id: 'rig', position: brief.coordinates, arrowCount: 10, radiusMeters: 40, ovalRatio: 1, rotationDegrees: 0 }
  brief.angles = [
    { id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 },
    { id: 'p1', label: 'P1', type: '360', position: brief.coordinates },
    { id: 's1', label: 'S1', type: 'dslr', position: brief.coordinates, directionDegrees: 90 },
  ]
  brief.typeSettings['360'] = { heightsMeters: [2, 5, 8] }
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
  const rig = screen.getByText('Circle rig', { exact: false }).closest('li')
  expect(within(rig!).getByText('Arrows 1-10:')).toHaveClass('whitespace-nowrap')
  expect(within(rig!).getByText('40m, 60m')).toHaveClass('whitespace-nowrap')
  expect(within(aerial!).getByText('Point 1:')).toHaveClass('whitespace-nowrap')
  expect(within(aerial!).getByText('40m, 60m')).toHaveClass('whitespace-nowrap')
  const panorama = screen.getByText('360°', { exact: false }).closest('li')
  expect(within(panorama!).getByText('Point 1:')).toHaveClass('whitespace-nowrap')
  expect(within(panorama!).getByText('2m, 5m, 8m')).toHaveClass('whitespace-nowrap')
  expect(within(dslr!).getByText('Point 1:')).toHaveClass('whitespace-nowrap')
  expect(within(dslr!).getByText('Ground-level')).toHaveClass('whitespace-nowrap')
})

it('isolates a capture type from the map overlay and restores all types on a second click', async () => {
  const onIsolate = vi.fn()
  const user = userEvent.setup()
  const view = render(<BriefingMapLayers brief={captureBrief()} language="en" isolatedKind={null} onIsolate={onIsolate} />)
  expect(screen.queryByRole('button', { name: 'Hide floorplan' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenCalledWith('drone-image')
  view.rerender(<BriefingMapLayers brief={captureBrief()} language="en" isolatedKind="drone-image" onIsolate={onIsolate} />)
  expect(screen.getByRole('button', { name: 'Show only Aerial photo' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenLastCalledWith(null)
})

it('toggles the floorplan under the capture icons without isolating cameras', async () => {
  const onIsolate = vi.fn()
  const onFloorplanVisible = vi.fn()
  const brief = captureBrief()
  brief.imageOverlays = [{
    id: 'plan', name: 'Plan', source: 'data:image/png;base64,AAAA', position: brief.coordinates,
    widthMeters: 40, heightMeters: 30, rotationDegrees: 0, opacity: 0.7,
  }]
  const user = userEvent.setup()
  const view = render(<BriefingMapLayers brief={brief} language="en" isolatedKind={null} onIsolate={onIsolate} floorplanVisible onFloorplanVisible={onFloorplanVisible} />)
  const hide = screen.getByRole('button', { name: 'Hide floorplan' })
  expect(hide).toHaveAttribute('aria-pressed', 'true')
  await user.click(hide)
  expect(onFloorplanVisible).toHaveBeenCalledWith(false)
  expect(onIsolate).not.toHaveBeenCalled()
  view.rerender(<BriefingMapLayers brief={brief} language="en" isolatedKind={null} onIsolate={onIsolate} floorplanVisible={false} onFloorplanVisible={onFloorplanVisible} />)
  expect(screen.getByRole('button', { name: 'Show floorplan' })).toHaveAttribute('aria-pressed', 'false')
})

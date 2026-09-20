import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '../model/brief'
import { CaptureInstructionsList } from './capture-instructions-list'

it('isolates a capture type and restores all types on a second click', async () => {
  const brief = createBrief({ name: 'Capture', clientName: 'Client' })
  brief.angles = [
    { id: 'd1', label: 'D1', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 },
    { id: 's1', label: 'S1', type: 'dslr', position: brief.coordinates, directionDegrees: 90 },
  ]
  const onIsolate = vi.fn()
  const user = userEvent.setup()
  const view = render(<CaptureInstructionsList brief={brief} language="en" isolatedKind={null} onIsolate={onIsolate} />)
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenCalledWith('drone-image')
  view.rerender(<CaptureInstructionsList brief={brief} language="en" isolatedKind="drone-image" onIsolate={onIsolate} />)
  expect(screen.getByRole('button', { name: 'Show only Aerial photo' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Show only Aerial photo' }))
  expect(onIsolate).toHaveBeenLastCalledWith(null)
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { createBrief } from '@/features/briefs/model/brief'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { exportBriefKey } from '@/features/briefs/storage/share-key'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '') })
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('creates with multiple times, saves edits, exports, and resumes after remount', async () => {
  const user = userEvent.setup()
  const app = render(<App />)
  await user.click(screen.getByRole('button', { name: 'Create a brief' }))
  await user.type(screen.getByLabelText('Project name'), 'Riverside')
  await user.type(screen.getByLabelText('Client name'), 'Client A')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.change(screen.getByLabelText('Shoot date'), { target: { value: '2026-09-11' } })
  await user.click(screen.getByRole('button', { name: 'Add time' }))
  await user.click(screen.getByRole('button', { name: 'Create brief' }))
  expect(screen.getByText('Saved on this device')).toBeInTheDocument()
  expect(briefRepository.latest()?.project.times).toEqual(['09:00', '12:00'])
  await user.click(screen.getByRole('button', { name: 'Add circle rig at project location' }))
  const radius = screen.getByLabelText('Radius (m)')
  await user.clear(radius); await user.type(radius, '85'); await user.tab()
  expect(briefRepository.latest()?.circleRig?.radiusMeters).toBe(85)
  await user.click(screen.getByRole('button', { name: 'Export' }))
  expect((screen.getByLabelText('Export key') as HTMLTextAreaElement).value).toMatch(/^DB1\./)
  app.unmount()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Resume editing' }))
  expect(screen.getByLabelText('Radius (m)')).toHaveValue(85)
})

it('loads a viewer and toggles layers without writing or replacing the local draft', async () => {
  const own = createBrief({ name: 'My draft', clientName: 'Owner', date: '2026-09-11', times: ['09:00'] })
  briefRepository.save(own)
  const shared = createBrief({ name: 'Shared shoot', clientName: 'Other client', date: '2026-09-12', times: ['10:00'] })
  shared.circleRig = { id: 'rig', position: shared.coordinates, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0 }
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Load a brief' }))
  await user.click(screen.getByLabelText('Export key'))
  await user.paste(exportBriefKey(shared))
  await user.click(screen.getByRole('button', { name: 'Open read-only brief' }))
  expect(screen.getByText('Read-only')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Layers' }))
  await user.click(screen.getByRole('switch', { name: 'Circle rig' }))
  expect(screen.getByRole('switch', { name: 'Circle rig' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.queryByText(/50 m radius/)).not.toBeInTheDocument()
  expect(writes).not.toHaveBeenCalled()
  expect(briefRepository.latest()?.id).toBe(own.id)
})

it('shows a save failure and keeps export available', async () => {
  const own = createBrief({ name: 'My draft', clientName: 'Owner', date: '2026-09-11', times: ['09:00'] })
  briefRepository.save(own)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full') })
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Resume editing' }))
  expect(screen.getByText('Not saved')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('export a key')
  await user.click(screen.getByRole('button', { name: 'Export' }))
  expect((screen.getByLabelText('Export key') as HTMLTextAreaElement).value).toMatch(/^DB1\./)
})

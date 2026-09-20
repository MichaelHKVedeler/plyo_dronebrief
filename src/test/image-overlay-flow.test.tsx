import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { createBrief } from '@/features/briefs/model/brief'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { exportBriefKey } from '@/features/briefs/storage/share-key'
import { readImageHandle, readLocalImage, rememberImageHandle, imagePicker } from '@/features/briefs/storage/local-images'

vi.mock('@/features/cloud/auth/config', () => ({ cloudConfigured: false }))

vi.mock('@/features/briefs/storage/local-images', () => ({
  imagePicker: vi.fn(() => undefined), readImageHandle: vi.fn(async () => undefined),
  rememberImageHandle: vi.fn(async () => {}), readLocalImage: vi.fn(async () => ({ url: 'blob:local-only', width: 640, height: 360 })),
}))
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  vi.stubGlobal('URL', class extends URL { static revokeObjectURL = vi.fn() })
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  vi.mocked(imagePicker).mockReturnValue(undefined)
  vi.mocked(readImageHandle).mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const project = { name: 'Local overlay', clientName: 'Test', date: '2026-09-13', times: ['09:00'] }
const file = new File(['test'], 'plan.png', { type: 'image/png' })
async function resume() {
  briefRepository.save(createBrief(project))
  const user = userEvent.setup(); const app = render(<App />)
  await user.click(screen.getByRole('button', { name: 'Resume editing' }))
  await user.click(screen.getByRole('tab', { name: 'Contents' }))
  return { user, app }
}
it('adds a local image to a hidden layer, saves metadata, adjusts visibility, and recovers after reopening', async () => {
  const { user, app } = await resume()
  await user.click(within(screen.getByRole('region', { name: 'Brief map' })).getByRole('switch', { name: 'Image overlays' }))
  await user.upload(screen.getByLabelText('Local image file'), file)
  await waitFor(() => expect(briefRepository.latest()?.imageOverlays).toHaveLength(1))
  expect(within(screen.getByRole('region', { name: 'Brief map' })).getByRole('switch', { name: 'Image overlays' })).toHaveAttribute('aria-checked', 'true')
  const overlay = briefRepository.latest()!.imageOverlays[0]
  expect(overlay.source).toMatchObject({ kind: 'local-file', fileName: 'plan.png' })
  expect(JSON.stringify(briefRepository.latest())).not.toMatch(/blob:|base64|fakepath/)
  const opacity = screen.getByRole('slider', { name: 'plan.png visibility' })
  opacity.focus(); await user.keyboard('{Home}{ArrowRight}')
  expect(briefRepository.latest()!.imageOverlays[0].opacity).toBe(0.01)
  await user.click(screen.getByRole('button', { name: 'Export key' }))
  expect(screen.getByText(/Local images are not included/)).toBeVisible()
  app.unmount(); render(<App />)
  await user.click(screen.getByRole('button', { name: 'Resume editing' }))
  await user.click(screen.getByRole('tab', { name: 'Contents' }))
  expect(await screen.findByRole('button', { name: 'Reconnect image' })).toBeVisible()
  expect(briefRepository.latest()!.imageOverlays[0].position).toEqual(overlay.position)
})
it('remembers a native file handle separately from the saved brief', async () => {
  const handle = { getFile: vi.fn(async () => file) } as unknown as Awaited<ReturnType<typeof readImageHandle>>
  vi.mocked(imagePicker).mockReturnValue(vi.fn(async () => [handle!]))
  const { user } = await resume()
  await user.click(screen.getByRole('button', { name: 'Upload image' }))
  await waitFor(() => expect(rememberImageHandle).toHaveBeenCalledOnce())
  expect(briefRepository.latest()?.imageOverlays).toHaveLength(1)
  expect(JSON.stringify(briefRepository.latest())).not.toContain('getFile')
})
it('reconnects local images in a viewer without saving or permitting edits', async () => {
  briefRepository.save(createBrief(project))
  const shared = createBrief({ ...project, name: 'Shared image' })
  shared.imageOverlays = [{ id: 'overlay', name: 'plan.png', source: { kind: 'local-file', fileId: crypto.randomUUID(), fileName: 'plan.png' }, position: shared.coordinates, widthMeters: 50, heightMeters: 30, rotationDegrees: 15, opacity: 0.5 }]
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  const user = userEvent.setup(); render(<App />)
  await user.click(screen.getByRole('button', { name: 'Load a brief' }))
  await user.click(screen.getByLabelText('Export key')); await user.paste(exportBriefKey(shared))
  await user.click(screen.getByRole('button', { name: 'Open read-only brief' }))
  await user.click(screen.getByRole('tab', { name: 'Contents' }))
  expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remove plan.png' })).not.toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'plan.png visibility' })).toHaveAttribute('data-disabled')
  await user.click(await screen.findByRole('button', { name: 'Reconnect image' }))
  await user.upload(screen.getByLabelText('Local image file'), file)
  await waitFor(() => expect(readLocalImage).toHaveBeenCalledOnce())
  await user.click(screen.getByRole('button', { name: 'View floorplan' }))
  expect(screen.getByRole('img', { name: 'plan.png' })).toHaveAttribute('src', 'blob:local-only')
  await user.keyboard('{Escape}')
  await user.click(within(screen.getByRole('region', { name: 'Brief map' })).getByRole('switch', { name: 'Image overlays' }))
  expect(writes).not.toHaveBeenCalled()
  expect(briefRepository.latest()!.project.name).toBe(project.name)
})
it('shows a save failure after upload while retaining the image in the open scene', async () => {
  const { user } = await resume()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
  await user.upload(screen.getByLabelText('Local image file'), file)
  expect(await screen.findByText('Not saved')).toBeVisible()
  expect(screen.getByRole('slider', { name: 'plan.png visibility' })).toBeVisible()
  expect(screen.getByText(/Changes could not be saved/)).toBeVisible()
})
it('adds a reference image below the floor plan and stores it in the draft', async () => {
  const { user } = await resume()
  await user.upload(screen.getByLabelText('Reference image file'), file)
  await waitFor(() => expect(briefRepository.latest()?.references).toHaveLength(1))
  const reference = briefRepository.latest()!.references[0]
  expect(reference.caption).toBe('plan')
  expect(reference.source).toMatchObject({ kind: 'local-file', fileName: 'plan.png' })
  expect(JSON.stringify(briefRepository.latest())).not.toMatch(/blob:|base64|fakepath/)
  await user.click(screen.getByRole('button', { name: 'View reference' }))
  expect(screen.getByRole('img', { name: 'plan' })).toHaveAttribute('src', 'blob:local-only')
})

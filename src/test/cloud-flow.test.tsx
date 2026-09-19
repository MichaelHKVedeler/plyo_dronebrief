import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { CloudApp } from '@/pages/cloud-app'
import { createBrief } from '@/features/briefs/model/brief'
import type { CloudProject, Organization } from '@/features/cloud/model/cloud'
import { cloudLibrary } from '@/features/cloud/storage/library-repository'
import { cloudProjects, loadPublic } from '@/features/cloud/storage/project-repository'
import { callCloud, signInGoogle } from '@/features/cloud/auth/firebase'
import { briefRepository } from '@/features/briefs/storage/brief-repository'
import { exportBriefKey } from '@/features/briefs/storage/share-key'
import type { PdfExportInput } from '@/features/briefs/export/pdf-types'

const pdf = vi.hoisted(() => ({ create: vi.fn(async (_input: PdfExportInput) => new Uint8Array([1])), download: vi.fn() }))
vi.mock('@/features/briefs/export/create-brief-pdf', () => ({ createBriefPdf: pdf.create }))
vi.mock('@/features/briefs/export/pdf-browser', () => ({ loadPdfAssets: vi.fn(async () => ({})), downloadPdf: pdf.download, pdfReference: vi.fn() }))
vi.mock('@/features/map/pdf-address', () => ({ lookupPdfAddress: vi.fn(async () => 'Oslo') }))

let account: { user: { uid: string; displayName: string; email: string } | null; organizations: Organization[]; loading: boolean; error: null; refresh: () => Promise<void> }
vi.mock('@/features/cloud/auth/use-account', () => ({ useAccount: () => account }))
vi.mock('@/features/cloud/auth/firebase', () => ({ callCloud: vi.fn(), cloudError: (error: Error) => error.message, signInGoogle: vi.fn(), signOutGoogle: vi.fn() }))
vi.mock('@/features/cloud/storage/project-repository', () => ({ cloudProjects: { load: vi.fn(), watch: vi.fn(() => () => {}), save: vi.fn(), create: vi.fn(), list: vi.fn(), trash: vi.fn() }, loadPublic: vi.fn() }))
vi.mock('@/features/cloud/storage/library-repository', () => ({ cloudLibrary: { search: vi.fn(), collections: vi.fn(async () => ({ collections: [], creators: [] })) } }))
vi.mock('@/features/cloud/storage/uploads', () => ({ downloadFloorplan: vi.fn(), uploadFloorplan: vi.fn() }))
const project = (): CloudProject => {
  const brief = createBrief({ name: 'Cloud project', clientName: 'Client' })
  return { envelopeVersion: 1, brief, assets: {}, summary: { id: 'project', orgId: 'org', name: brief.project.name, clientName: brief.project.clientName, revision: 1, createdBy: { uid: 'owner', name: 'Owner' }, editedBy: { uid: 'owner', name: 'Owner' }, createdAt: brief.createdAt, updatedAt: brief.updatedAt, deletedAt: null, collectionId: null, collectionName: '' } }
}
beforeEach(() => {
  history.replaceState(null, '', '/'); localStorage.clear(); vi.clearAllMocks()
  account = { user: { uid: 'owner', displayName: 'Owner', email: 'owner@plyo.com' }, organizations: [{ id: 'org', name: 'Plyo', role: 'admin', indexing: false }], loading: false, error: null, refresh: async () => {} }
  vi.mocked(callCloud).mockResolvedValue({ collections: [], creators: [], token: null })
  vi.mocked(cloudLibrary.search).mockResolvedValue({ projects: [], cursor: null, indexing: false })
})
afterEach(() => { cleanup(); history.replaceState(null, '', '/'); vi.restoreAllMocks() })
it('retains an authenticated deep link while presenting Google sign-in', async () => {
  history.replaceState(null, '', '/#/projects/project'); account.user = null
  render(<CloudApp />)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
  expect(signInGoogle).toHaveBeenCalledOnce(); expect(location.hash).toBe('#/projects/project')
  expect(cloudProjects.load).not.toHaveBeenCalled()
})
it('opens the dedicated project library and handles its empty state', async () => {
  render(<CloudApp />)
  await userEvent.click(screen.getByRole('button', { name: 'Load projects' }))
  expect(await screen.findByText('No projects match this view.')).toBeVisible()
  expect(cloudLibrary.search).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org', view: 'mine' }))
})
it('opens public links without sign-in and never writes drafts or cloud updates', async () => {
  history.replaceState(null, '', '/#/s/' + 'x'.repeat(43)); account.user = null
  vi.mocked(loadPublic).mockResolvedValue(project())
  const writes = vi.spyOn(briefRepository, 'save')
  render(<CloudApp />)
  expect(await screen.findByText('Public read-only project')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
  const toggles = screen.getAllByRole('switch'); if (toggles[0]) await userEvent.click(toggles[0])
  expect(writes).not.toHaveBeenCalled(); expect(cloudProjects.save).not.toHaveBeenCalled()
})
it('persists committed edits under StrictMode and surfaces save conflicts without losing local data', async () => {
  const data = project(); history.replaceState(null, '', '/#/projects/project')
  vi.mocked(cloudProjects.load).mockResolvedValue(data)
  vi.mocked(cloudProjects.save).mockRejectedValue({ code: 'functions/aborted', message: 'Another editor saved.' })
  render(<StrictMode><CloudApp /></StrictMode>)
  const name = await screen.findByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'My unsaved work' } }); fireEvent.blur(name)
  await waitFor(() => expect(screen.getByText('Conflict')).toBeVisible())
  expect(screen.getByRole('button', { name: 'Save as a new project' })).toBeVisible()
  expect(name).toHaveValue('My unsaved work')
  await userEvent.click(screen.getByRole('button', { name: 'Export snapshot' }))
  expect((screen.getByLabelText('Export key') as HTMLTextAreaElement).value).toMatch(/^DB2\./)
})
it('clears another account’s project immediately while the new account is loading', async () => {
  history.replaceState(null, '', '/#/projects/project')
  vi.mocked(cloudProjects.load).mockResolvedValueOnce(project())
  const view = render(<CloudApp />)
  expect(await screen.findByLabelText('Project name')).toHaveValue('Cloud project')
  account = { ...account, user: { uid: 'different', displayName: 'Different', email: 'different@example.com' } }
  vi.mocked(cloudProjects.load).mockImplementationOnce(() => new Promise(() => {}))
  view.rerender(<CloudApp />)
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
  expect(screen.getByText('Loading project…')).toBeVisible()
})

it('keeps the cloud project title in the header and saves PDF notes through cloud autosave', async () => {
  const data = project(); history.replaceState(null, '', '/#/projects/project')
  data.brief.project.shoots = [{ date: '2026-09-19', time: '09:00', endTime: '14:00' }]
  vi.mocked(cloudProjects.load).mockResolvedValue(data)
  vi.mocked(cloudProjects.save).mockResolvedValue({ ...data.summary, revision: 2 })
  const writes = vi.spyOn(briefRepository, 'save')
  render(<CloudApp />)
  const name = await screen.findByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'Updated cloud title' } }); fireEvent.blur(name)
  expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Updated cloud title' })).toBeVisible()
  await waitFor(() => expect(cloudProjects.save).toHaveBeenCalledTimes(1))
  await userEvent.click(screen.getByRole('button', { name: 'Export as PDF' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.change(screen.getByLabelText('Instructions (optional)'), { target: { value: 'Use the east entrance.' } })
  expect(screen.getByRole('switch', { name: 'Save these notes to the brief when exporting' })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await userEvent.click(screen.getByRole('button', { name: 'Point diagram' }))
  await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
  await waitFor(() => expect(pdf.download).toHaveBeenCalledOnce())
  await waitFor(() => expect(cloudProjects.save).toHaveBeenCalledTimes(2))
  expect(cloudProjects.save).toHaveBeenLastCalledWith('project', 2, expect.any(String), expect.objectContaining({ project: expect.objectContaining({ name: 'Updated cloud title', instructions: 'Use the east entrance.', shoots: data.brief.project.shoots }) }), {})
  expect(writes).not.toHaveBeenCalled()
})

it.each(['public', 'snapshot'])('exports a %s viewer PDF without saving edits to the project', async (kind) => {
  const data = project(); account.user = null
  if (kind === 'public') {
    history.replaceState(null, '', '/#/s/' + 'x'.repeat(43))
    vi.mocked(loadPublic).mockResolvedValue(data)
  }
  const writes = vi.spyOn(briefRepository, 'save')
  render(<CloudApp />)
  if (kind === 'snapshot') {
    await userEvent.click(screen.getByRole('button', { name: 'Open portable snapshot' }))
    fireEvent.change(screen.getByLabelText('Export key'), { target: { value: exportBriefKey(data.brief) } })
    await userEvent.click(screen.getByRole('button', { name: 'Open read-only brief' }))
  }
  await userEvent.click(await screen.findByRole('button', { name: 'Export as PDF' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByRole('switch', { name: 'Save these notes to the brief when exporting' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Instructions (optional)'), { target: { value: 'Only in this PDF.' } })
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await userEvent.click(screen.getByRole('button', { name: 'Point diagram' }))
  await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
  await waitFor(() => expect(pdf.download).toHaveBeenCalledOnce())
  expect(pdf.create).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.objectContaining({ instructions: 'Only in this PDF.' }) }), expect.anything())
  expect(cloudProjects.save).not.toHaveBeenCalled(); expect(writes).not.toHaveBeenCalled()
})

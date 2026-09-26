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
import { exportCloudSnapshot } from '@/features/cloud/components/cloud-brief'
import type { PdfExportInput } from '@/features/briefs/export/pdf-types'

const pdf = vi.hoisted(() => ({ create: vi.fn(async (_input: PdfExportInput) => new Uint8Array([1])), download: vi.fn() }))
vi.mock('@/features/briefs/export/create-brief-pdf', () => ({ createBriefPdf: pdf.create }))
vi.mock('@/features/briefs/export/pdf-browser', () => ({ loadPdfAssets: vi.fn(async () => ({})), downloadPdf: pdf.download, pdfReference: vi.fn(), pdfReferenceFromUrl: vi.fn() }))
vi.mock('@/features/map/pdf-address', () => ({ lookupPdfAddress: vi.fn(async () => 'Oslo') }))

let account: { user: { uid: string; displayName: string; email: string } | null; organizations: Organization[]; loading: boolean; error: null; refresh: () => Promise<void> }
vi.mock('@/features/cloud/auth/use-account', () => ({ useAccount: () => account }))
vi.mock('@/features/cloud/auth/firebase', () => ({ callCloud: vi.fn(), cloudError: (error: Error) => error.message, signInGoogle: vi.fn(), signOutGoogle: vi.fn() }))
vi.mock('@/features/cloud/storage/project-repository', () => ({ cloudProjects: { load: vi.fn(), watch: vi.fn(() => () => {}), save: vi.fn(), create: vi.fn(), list: vi.fn(), trash: vi.fn(), purge: vi.fn(), rename: vi.fn() }, loadPublic: vi.fn() }))
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
it('shows a satellite thumbnail of the editor map on each project card', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')
  const summary = { ...project().summary, map: { lat: 59.9139, lng: 10.7522, zoom: 10 } }
  vi.mocked(cloudLibrary.search).mockResolvedValue({ projects: [summary], cursor: null, indexing: false })
  render(<CloudApp />)
  expect(await screen.findByRole('img', { name: 'Cloud project map' })).toHaveAttribute('data-zoom', '10')
  expect(cloudProjects.load).not.toHaveBeenCalled()
  vi.unstubAllEnvs()
})
it('loads a saved project to frame its map when the library summary has no location', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')
  const saved = project()
  vi.mocked(cloudProjects.load).mockResolvedValue(saved)
  vi.mocked(cloudLibrary.search).mockResolvedValue({ projects: [saved.summary], cursor: null, indexing: false })
  render(<CloudApp />)
  expect(await screen.findByRole('img', { name: 'Cloud project map' })).toHaveAttribute('data-zoom', '10')
  expect(cloudProjects.load).toHaveBeenCalledWith('project')
  vi.unstubAllEnvs()
})
it('opens the project library on the home screen and handles its empty state', async () => {
  render(<CloudApp />)
  expect(await screen.findByRole('heading', { name: 'My projects' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Organization projects' }).querySelector('img')).toHaveAttribute('src', expect.stringContaining('plyo-mark-flat-ink.svg'))
  expect(screen.getByRole('button', { name: 'Deleted projects' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Import snapshot' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Refresh access' })).not.toBeInTheDocument()
  const manage = screen.getByRole('button', { name: 'Manage organization' })
  const accountName = screen.getByTitle('Owner')
  const signOut = screen.getByRole('button', { name: 'Sign out' })
  expect(manage.compareDocumentPosition(accountName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(accountName.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('button', { name: 'New project' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'New collection' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Load projects' })).not.toBeInTheDocument()
  expect(await screen.findByText('No projects match this view.')).toBeVisible()
  expect(cloudLibrary.search).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org', view: 'mine' }))
})
it('renames a project from its card and can restore or permanently delete it', async () => {
  const summary = project().summary
  vi.mocked(cloudLibrary.search).mockImplementation(async (query) => ({ projects: query.view === 'trash' ? [{ ...summary, deletedAt: summary.updatedAt }] : [summary], cursor: null, indexing: false }))
  vi.mocked(cloudProjects.rename).mockResolvedValue({ ...summary, name: 'Renamed project', revision: 2 })
  render(<CloudApp />)
  await userEvent.click(await screen.findByRole('button', { name: 'Rename Cloud project' }))
  const name = screen.getByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'Renamed project' } })
  fireEvent.blur(name)
  await waitFor(() => expect(cloudProjects.rename).toHaveBeenCalledWith('project', 'Renamed project'))
  await userEvent.click(screen.getByRole('button', { name: 'Deleted projects' }))
  expect(await screen.findByRole('heading', { name: 'Deleted projects' })).toBeVisible()
  await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))
  await waitFor(() => expect(cloudProjects.trash).toHaveBeenCalledWith('project', true))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete Cloud project permanently' }))
  await waitFor(() => expect(cloudProjects.purge).toHaveBeenCalledWith('project'))
})
it('opens public briefing links without sign-in and never writes drafts or cloud updates', async () => {
  history.replaceState(null, '', '/#/s/' + 'x'.repeat(43) + '?address=Karl%20Johans%20gate:%20Oslo')
  account.user = null
  const data = project()
  data.brief.circleRig = { id: 'rig', position: data.brief.coordinates, arrowCount: 10, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0 }
  data.brief.angles = [
    { id: 'd1', label: 'D1', type: 'drone-image', position: data.brief.coordinates, directionDegrees: 0 },
    { id: 's1', label: 'S1', type: 'dslr', position: data.brief.coordinates, directionDegrees: 90 },
  ]
  vi.mocked(loadPublic).mockResolvedValue(data)
  const writes = vi.spyOn(briefRepository, 'save')
  render(<CloudApp />)
  expect(await screen.findByRole('region', { name: 'Brief map' })).toBeInTheDocument()
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Map layers')).not.toBeInTheDocument()
  expect(screen.queryByRole('switch', { name: 'Circle rig' })).not.toBeInTheDocument()
  const aerial = screen.getByRole('button', { name: 'Show only Aerial photo' })
  await userEvent.click(aerial)
  expect(aerial).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Show only DSLR' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(aerial)
  expect(aerial).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Project information' }))
  const details = screen.getByLabelText('Brief details')
  expect(within(details).getByText('Shoot times')).toBeVisible()
  expect(within(details).getByText('Large project')).toBeVisible()
  expect(within(details).getByText("Automatically matched to the template's point counts and height levels. Rig arrows count as aerial positions.")).toBeVisible()
  expect(within(details).getByText('Dronebrief')).toBeVisible()
  expect(within(details).getByRole('heading', { name: 'Cloud project' })).toBeVisible()
  expect(within(details).getByText('Client')).toBeVisible()
  expect(within(details).getByText('Karl Johans gate: Oslo')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Created by Owner/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Edited by Owner/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dronebrief home' })).not.toBeInTheDocument()
  expect(screen.queryByRole('search')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ShadeMap' })).not.toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: 'Overlay size' })).not.toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: 'Map dimming' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch', { name: 'Satellite' }))
  expect(writes).not.toHaveBeenCalled(); expect(cloudProjects.save).not.toHaveBeenCalled()
})
it('persists committed edits under StrictMode and surfaces save conflicts without losing local data', async () => {
  const data = project(); history.replaceState(null, '', '/#/projects/project')
  vi.mocked(cloudProjects.load).mockResolvedValue(data)
  vi.mocked(cloudProjects.save).mockRejectedValue({ code: 'functions/aborted', message: 'Another editor saved.' })
  render(<StrictMode><CloudApp /></StrictMode>)
  await userEvent.click(await screen.findByRole('button', { name: 'Edit title' }))
  const name = screen.getByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'My unsaved work' } }); fireEvent.blur(name)
  await waitFor(() => expect(screen.getByText('Conflict')).toBeVisible())
  expect(screen.getByRole('button', { name: 'Save as a new project' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'My unsaved work' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Export snapshot' })).not.toBeInTheDocument()
  const keys: string[] = []
  exportCloudSnapshot({ ...data.brief, project: { ...data.brief.project, name: 'My unsaved work' } }, (value) => keys.push(value), () => { throw new Error('snapshot export failed') })
  expect(keys[0]).toMatch(/^DB2\./)
})
it('clears another account’s project immediately while the new account is loading', async () => {
  history.replaceState(null, '', '/#/projects/project')
  vi.mocked(cloudProjects.load).mockResolvedValueOnce(project())
  const view = render(<CloudApp />)
  expect(await screen.findByRole('heading', { name: 'Cloud project' })).toBeVisible()
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
  await userEvent.click(await screen.findByRole('button', { name: 'Edit title' }))
  const name = screen.getByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'Updated cloud title' } }); fireEvent.blur(name)
  expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Updated cloud title' })).toBeVisible()
  await waitFor(() => expect(cloudProjects.save).toHaveBeenCalledTimes(1))
  await userEvent.click(screen.getByRole('button', { name: 'Export' }))
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

it('exports a snapshot viewer PDF without saving edits to the project', async () => {
  const data = project(); account.user = null
  const writes = vi.spyOn(briefRepository, 'save')
  render(<CloudApp />)
  await userEvent.click(screen.getByRole('button', { name: 'Open portable snapshot' }))
  fireEvent.change(screen.getByLabelText('Export key'), { target: { value: exportBriefKey(data.brief) } })
  await userEvent.click(screen.getByRole('button', { name: 'Open read-only brief' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
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

it('creates a public briefing link from Export without capturing the map', async () => {
  const data = project(); history.replaceState(null, '', '/#/projects/project')
  vi.mocked(cloudProjects.load).mockResolvedValue(data)
  vi.mocked(callCloud).mockImplementation(async (operation) => {
    if (operation === 'share') return { token: 'y'.repeat(43) }
    return { collections: [], creators: [], token: null }
  })
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<CloudApp />)
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.change(screen.getByLabelText('Instructions (optional)'), { target: { value: 'Use the east entrance.' } })
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByRole('group', { name: 'PDF map source' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Create link' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#/s/' + 'y'.repeat(43)))
  await waitFor(() => expect(cloudProjects.save).toHaveBeenCalled())
  expect(cloudProjects.save).toHaveBeenCalledWith('project', 1, expect.any(String), expect.objectContaining({ project: expect.objectContaining({ instructions: 'Use the east entrance.' }) }), {})
})

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BriefHeaderTitle } from './brief-header-title'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows a presentable title in view mode and hides editing controls', () => {
  render(<BriefHeaderTitle name="Mariakvartalet" clientName="OSU" mode="view" />)
  expect(screen.getByRole('heading', { name: 'Mariakvartalet' })).toBeVisible()
  expect(screen.getByText('OSU')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
})

it('keeps the editor on the display title until editing starts, then commits into the presentable title', async () => {
  const onUpdate = vi.fn()
  const user = userEvent.setup()
  const view = render(<BriefHeaderTitle name="Mariakvartalet" clientName="OSU" mode="edit" onUpdate={onUpdate} />)
  expect(screen.getByRole('heading', { name: 'Mariakvartalet' })).toBeVisible()
  expect(screen.getByText('OSU')).toBeVisible()
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edit title' }))
  const project = screen.getByLabelText('Project name')
  const client = screen.getByLabelText('Client name')
  expect(project).toHaveValue('Mariakvartalet')
  expect(client).toHaveValue('OSU')
  await user.clear(client)
  await user.type(client, 'Client B')
  fireEvent.blur(client)
  expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ clientName: 'Client B' })
  view.rerender(<BriefHeaderTitle name="Mariakvartalet" clientName="Client B" mode="edit" onUpdate={onUpdate} />)
  expect(screen.getByRole('heading', { name: 'Mariakvartalet' })).toBeVisible()
  expect(screen.getByText('Client B')).toBeVisible()
  expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument()
})

it('cancels an unfinished title edit with Escape', async () => {
  const onUpdate = vi.fn()
  const user = userEvent.setup()
  render(<BriefHeaderTitle name="Mariakvartalet" clientName="OSU" mode="edit" onUpdate={onUpdate} />)
  await user.click(screen.getByRole('heading', { name: 'Mariakvartalet' }))
  await user.clear(screen.getByLabelText('Project name'))
  await user.type(screen.getByLabelText('Project name'), 'Draft')
  await user.keyboard('{Escape}')
  expect(onUpdate).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Mariakvartalet' })).toBeVisible()
})

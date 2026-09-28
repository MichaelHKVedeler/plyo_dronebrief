import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionPicker } from './collection-picker'

vi.mock('../auth/firebase', () => ({ cloudError: (error: Error) => error.message }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function setup(onCreate = vi.fn<(name: string, id: string) => Promise<void>>().mockResolvedValue()) {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  const onChange = vi.fn()
  render(<CollectionPicker label="Collection" collections={[{ id: 'a', orgId: 'org', name: 'Oslo' }, { id: 'b', orgId: 'org', name: 'Oslo West' }]} value="" disabled={false} onChange={onChange} onCreate={onCreate} />)
  return { user: userEvent.setup(), onChange, onCreate }
}
it('puts matches before creation and selects an existing collection with the keyboard', async () => {
  const { user, onChange, onCreate } = setup()
  await user.click(screen.getByRole('combobox', { name: 'Collection' }))
  await user.type(screen.getByRole('combobox', { name: 'Search or add collection' }), 'Osl')
  expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(['Oslo', 'Oslo West', 'Add Osl'])
  await user.keyboard('{Enter}')
  expect(onChange).toHaveBeenCalledWith('a')
  expect(onCreate).not.toHaveBeenCalled()
})
it('does not offer duplicate names and creates then selects a new collection', async () => {
  const { user, onChange, onCreate } = setup()
  await user.click(screen.getByRole('combobox', { name: 'Collection' }))
  const input = screen.getByRole('combobox', { name: 'Search or add collection' })
  await user.type(input, 'oslo')
  expect(screen.queryByRole('option', { name: 'Add oslo' })).not.toBeInTheDocument()
  await user.clear(input); await user.type(input, ' Bergen ')
  await user.click(screen.getByRole('option', { name: 'Add Bergen' }))
  expect(onCreate).toHaveBeenCalledWith('Bergen', expect.any(String))
  expect(onChange).toHaveBeenCalledWith(onCreate.mock.calls[0][1])
})
it('keeps the selection unchanged on failure and reuses the creation id on retry', async () => {
  const onCreate = vi.fn<(_: string, id: string) => Promise<void>>().mockRejectedValueOnce(new Error('Cannot create collection')).mockResolvedValueOnce()
  const { user, onChange } = setup(onCreate)
  await user.click(screen.getByRole('combobox', { name: 'Collection' }))
  await user.type(screen.getByRole('combobox', { name: 'Search or add collection' }), 'Bergen')
  await user.click(screen.getByRole('option', { name: 'Add Bergen' }))
  expect(await screen.findByText('Cannot create collection')).toBeVisible()
  expect(onChange).not.toHaveBeenCalled()
  await user.click(screen.getByRole('option', { name: 'Add Bergen' }))
  expect(onCreate.mock.calls[1]).toEqual(onCreate.mock.calls[0])
  expect(onChange).toHaveBeenCalledWith(onCreate.mock.calls[0][1])
})

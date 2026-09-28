import { beforeEach, expect, it, vi } from 'vitest'
import { readCloud, writeCloud } from './read-request'
import { libraryQuerySchema } from '../model/cloud'
import { deferred } from '@/test/deferred'

const mock = vi.hoisted(() => ({ auth: { currentUser: { uid: 'owner' } as { uid: string } | null }, call: vi.fn() }))
vi.mock('../auth/firebase', () => ({ firebase: () => ({ auth: mock.auth }), callCloud: mock.call }))
beforeEach(() => { mock.auth.currentUser = { uid: 'owner' }; mock.call.mockReset() })

it('shares simultaneous account requests but fetches again after completion', async () => {
  const pending = deferred<unknown>()
  mock.call.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(['updated'])
  const first = readCloud('account')
  const second = readCloud('account')
  expect(first).toBe(second)
  expect(mock.call).toHaveBeenCalledTimes(1)
  pending.resolve(['initial'])
  await expect(first).resolves.toEqual(['initial'])
  await expect(readCloud('account')).resolves.toEqual(['updated'])
  expect(mock.call).toHaveBeenCalledTimes(2)
})

it('keeps organizations, filters and collection requests separate', async () => {
  const pending = deferred<unknown>()
  mock.call.mockReturnValue(pending.promise)
  const query = libraryQuerySchema.parse({ orgId: 'org' })
  const first = readCloud('library', query)
  expect(readCloud('library', { ...query })).toBe(first)
  expect(readCloud('library', { ...query, orgId: 'other' })).not.toBe(first)
  expect(readCloud('library', { ...query, search: 'new' })).not.toBe(first)
  expect(readCloud('collections', { orgId: 'org', action: 'list' })).not.toBe(first)
  expect(mock.call).toHaveBeenCalledTimes(4)
  pending.resolve(null)
  await first
})

it('does not reuse an earlier signed-in session, even for the same uid', async () => {
  const pending = deferred<unknown>()
  mock.call.mockReturnValue(pending.promise)
  const first = readCloud('account')
  mock.auth.currentUser = { uid: 'other' }
  const second = readCloud('account')
  mock.auth.currentUser = { uid: 'owner' }
  const third = readCloud('account')
  expect(second).not.toBe(first)
  expect(third).not.toBe(first)
  expect(mock.call).toHaveBeenCalledTimes(3)
  pending.resolve([])
  await Promise.all([first, second, third])
})

it('releases failed requests so Retry can recover', async () => {
  mock.call.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([])
  await expect(readCloud('account')).rejects.toThrow('Offline')
  await expect(readCloud('account')).resolves.toEqual([])
  expect(mock.call).toHaveBeenCalledTimes(2)
})

it('fetches fresh data after mutations while an older response is pending', async () => {
  const old = deferred<unknown>()
  const fresh = deferred<unknown>()
  mock.call.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ok: true }).mockReturnValueOnce(fresh.promise)
  const query = libraryQuerySchema.parse({ orgId: 'org' })
  const before = readCloud('library', query)
  await writeCloud('renameProject', { projectId: 'project', name: 'Renamed' })
  const after = readCloud('library', query)
  expect(after).not.toBe(before)
  old.resolve(['Old name'])
  await before
  expect(readCloud('library', query)).toBe(after)
  fresh.resolve(['Renamed'])
  await expect(after).resolves.toEqual(['Renamed'])
  expect(mock.call).toHaveBeenCalledTimes(3)
})

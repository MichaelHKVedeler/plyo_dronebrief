import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { useAccount } from './use-account'
import { deferred } from '@/test/deferred'

const mock = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  listeners: new Set<(user: User | null) => void>(),
  call: vi.fn(),
}))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) => {
  mock.listeners.add(listener)
  listener(mock.auth.currentUser)
  return () => mock.listeners.delete(listener)
} }))
vi.mock('./firebase', () => ({ firebase: () => ({ auth: mock.auth }), callCloud: mock.call, cloudError: (error: Error) => error.message }))
const organization = (id: string) => ({ id, name: id, role: 'member', indexing: false })
function signIn(uid: string | null) {
  act(() => {
    mock.auth.currentUser = uid ? { uid } as User : null
    mock.listeners.forEach((listener) => listener(mock.auth.currentUser))
  })
}
beforeEach(() => { mock.auth.currentUser = { uid: 'owner' } as User; mock.call.mockReset() })
afterEach(cleanup)

it('finishes loading in StrictMode with one account request', async () => {
  const pending = deferred<unknown>()
  mock.call.mockReturnValue(pending.promise)
  const { result } = renderHook(useAccount, { wrapper: StrictMode })
  expect(result.current.loading).toBe(true)
  expect(mock.call).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve([organization('org')]))
  expect(result.current.loading).toBe(false)
  expect(result.current.organizations).toEqual([organization('org')])
})

it('ignores a slow response from an account that has signed out', async () => {
  const first = deferred<unknown>()
  mock.call.mockReturnValueOnce(first.promise).mockResolvedValueOnce([organization('other-org')])
  const { result } = renderHook(useAccount)
  signIn(null)
  expect(result.current).toMatchObject({ user: null, organizations: [], loading: false })
  signIn('other')
  await waitFor(() => expect(result.current.organizations).toEqual([organization('other-org')]))
  await act(async () => first.resolve([organization('old-org')]))
  expect(result.current.user?.uid).toBe('other')
  expect(result.current.organizations).toEqual([organization('other-org')])
})

it('shows account failures and performs a fresh request on retry', async () => {
  mock.call.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce([])
  const { result } = renderHook(useAccount)
  await waitFor(() => expect(result.current.error).toBe('Connection failed'))
  expect(result.current.loading).toBe(false)
  await act(() => result.current.refresh())
  expect(result.current).toMatchObject({ organizations: [], error: null, loading: false })
  expect(mock.call).toHaveBeenCalledTimes(2)
})

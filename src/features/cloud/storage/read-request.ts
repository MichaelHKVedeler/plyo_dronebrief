import type { User } from 'firebase/auth'
import { callCloud, firebase } from '../auth/firebase'
import type { LibraryQuery } from '../model/cloud'

const pending = new WeakMap<User, Map<string, Promise<unknown>>>()

// Share only simultaneous reads, scoped to the signed-in User instance. Settled
// responses are never cached: refreshes and permission changes need fresh data.
export function readCloud<T>(operation: 'account'): Promise<T>
export function readCloud<T>(operation: 'library', data: LibraryQuery): Promise<T>
export function readCloud<T>(operation: 'collections', data: { orgId: string; action: 'list' }): Promise<T>
export function readCloud<T>(operation: string, data: unknown = {}): Promise<T> {
  const user = firebase().auth.currentUser
  if (!user) return callCloud<T>(operation, data)
  let requests = pending.get(user)
  if (!requests) { requests = new Map(); pending.set(user, requests) }
  const key = JSON.stringify([operation, data])
  const existing = requests.get(key)
  if (existing) return existing as Promise<T>
  const request = callCloud<T>(operation, data).finally(() => requests.delete(key))
  requests.set(key, request)
  return request
}

// A mutation can finish while an older read is still in flight. Refreshes after
// that mutation must not join the older request (even after an uncertain failure).
export async function writeCloud<T>(operation: string, data: unknown): Promise<T> {
  const user = firebase().auth.currentUser
  try { return await callCloud<T>(operation, data) }
  finally { if (user) pending.delete(user) }
}

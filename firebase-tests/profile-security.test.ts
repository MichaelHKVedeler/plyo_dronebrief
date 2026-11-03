import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../functions/src/context'
import { initializeAccount } from '../functions/src/organizations'

let env: RulesTestEnvironment
const user = { uid: 'profile-user', name: 'User', email: 'user@example.test' }
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dronebrief', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
})
beforeEach(async () => { await env.clearFirestore() })
afterAll(async () => { await env.cleanup() })

it('does not create a profile for an uninvited Google account', async () => {
  expect(await initializeAccount(user)).toEqual([])
  expect(await initializeAccount(user)).toEqual([])
  expect((await db.doc(`users/${user.uid}`).get()).exists).toBe(false)
})
it('coalesces profile writes but still refreshes changed names and stale timestamps', async () => {
  await db.doc(`users/${user.uid}/organizations/org`).set({ id: 'org', name: 'Org', role: 'member' })
  await initializeAccount(user)
  const first = await db.doc(`users/${user.uid}`).get()
  await initializeAccount(user)
  expect((await db.doc(`users/${user.uid}`).get()).updateTime).toEqual(first.updateTime)
  await initializeAccount({ ...user, name: 'Changed' })
  expect((await db.doc(`users/${user.uid}`).get()).get('name')).toBe('Changed')
  await db.doc(`users/${user.uid}`).update({ lastSeenAt: new Date(0).toISOString() })
  await initializeAccount(user)
  expect(Date.parse((await db.doc(`users/${user.uid}`).get()).get('lastSeenAt'))).toBeGreaterThan(Date.now() - 60_000)
})
it('does not let authenticated clients read or reset private quotas', async () => {
  const client = env.authenticatedContext(user.uid, { email: user.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore()
  for (const collection of ['rateLimits', 'uploadBudgets']) {
    await db.doc(`${collection}/budget`).set({ count: 100 })
    await assertFails(getDoc(doc(client, collection, 'budget')))
    await assertFails(setDoc(doc(client, collection, 'budget'), { count: 0 }))
  }
})

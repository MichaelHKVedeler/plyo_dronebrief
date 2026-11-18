// @vitest-environment node
import { expect, it } from 'vitest'
import { requireAccounts } from './accounts-sync'
import { emailKey } from './context'
import { membershipChanges } from './organizations'

const claims = { aud: 'https://plyo-dronebrief.web.app/accounts-sync', email: 'shared-login-bridge@plyo-accounts-prod.iam.gserviceaccount.com', email_verified: 'true' }
const google = (body: object, ok = true) => (async (url: string) => { expect(url).toBe('https://oauth2.googleapis.com/tokeninfo?id_token=a.b.c'); return { ok, json: async () => body } }) as unknown as typeof fetch

it('accepts the member list only from the sign-in service of production Plyo Accounts', async () => {
  await expect(requireAccounts('Bearer a.b.c', google(claims))).resolves.toBeUndefined()
  for (const change of [{ aud: 'https://plyo-dronebrief.web.app' }, { email: 'shared-login-bridge@plyo-accounts-staging.iam.gserviceaccount.com' }, { email_verified: 'false' }, { email: undefined }]) {
    await expect(requireAccounts('Bearer a.b.c', google({ ...claims, ...change }))).rejects.toThrow('Not allowed')
  }
  await expect(requireAccounts('Bearer a.b.c', google(claims, false)), 'Google refused the token').rejects.toThrow('Not allowed')
  for (const header of [undefined, 'a.b.c', 'Bearer not-a-token', 'Bearer a.b.c&x=1']) {
    await expect(requireAccounts(header, async () => { throw new Error('Google must not be asked') })).rejects.toThrow('Sign-in is required')
  }
})

it('turns the grants into the list Plyo Toolkits sent: adds, new roles and removals, nothing else', () => {
  const grant = (email: string, role: 'admin' | 'member', status: 'pending' | 'active' | 'revoked') => ({ id: emailKey(email), role, status })
  const grants = [grant('stays@plyo.com', 'member', 'active'), grant('promoted@plyo.com', 'member', 'pending'), grant('leaves@plyo.com', 'admin', 'active'), grant('back@plyo.com', 'admin', 'revoked'), grant('gone@plyo.com', 'member', 'revoked')]
  expect(membershipChanges(grants, [{ email: 'Stays@plyo.com', role: 'member' }, { email: 'promoted@plyo.com', role: 'admin' }, { email: 'back@plyo.com', role: 'member' }, { email: 'new@plyo.com', role: 'admin' }])).toEqual([
    { action: 'role', grantId: emailKey('promoted@plyo.com'), role: 'admin' },
    { action: 'add', email: 'back@plyo.com', role: 'member' },
    { action: 'add', email: 'new@plyo.com', role: 'admin' },
    { action: 'remove', grantId: emailKey('leaves@plyo.com'), role: 'member' },
  ])
  expect(membershipChanges(grants.slice(0, 1), [{ email: 'stays@plyo.com', role: 'member' }])).toEqual([])
})

// @vitest-environment node
import { expect, it } from 'vitest'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { principal } from './context'

const call = (token: object) => principal({ auth: { uid: 'person', token } } as unknown as CallableRequest)
const toolkits = { email: 'Pilot@Plyo.com', name: 'Pilot', email_verified: true, firebase: { sign_in_provider: 'custom' }, plyo_tool: 'dronebrief', plyo_accounts_project: 'plyo-accounts-prod' }

it('accepts Google sign-in and Plyo Toolkits sessions for Dronebrief from production Accounts only', () => {
  expect(call({ ...toolkits, firebase: { sign_in_provider: 'google.com' }, plyo_tool: undefined })).toEqual({ uid: 'person', name: 'Pilot', email: 'pilot@plyo.com' })
  expect(call(toolkits)).toEqual({ uid: 'person', name: 'Pilot', email: 'pilot@plyo.com' })
  for (const change of [{ plyo_tool: 'renderflow' }, { plyo_tool: undefined }, { plyo_accounts_project: 'plyo-accounts-staging' }, { email_verified: false }, { email: undefined }, { firebase: { sign_in_provider: 'password' } }]) {
    expect(() => call({ ...toolkits, ...change })).toThrow('verified Google')
  }
})

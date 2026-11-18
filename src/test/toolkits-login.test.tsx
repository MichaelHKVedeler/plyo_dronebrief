import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const launch = vi.hoisted(() => ({ continueToolLaunch: vi.fn(), signIn: vi.fn(), auth: 'auth' as unknown }))
vi.mock('@/features/cloud/auth/config', () => ({ cloudConfigured: true }))
vi.mock('@plyo/accounts-client/tool-launch', async (original) => ({ ...await original<typeof import('@plyo/accounts-client/tool-launch')>(), hasToolLaunch: () => true, continueToolLaunch: launch.continueToolLaunch }))
vi.mock('firebase/auth', () => ({ signInWithCustomToken: launch.signIn }))
vi.mock('@/features/cloud/auth/firebase', () => ({ firebase: () => ({ auth: launch.auth }) }))
vi.mock('@/pages/cloud-app', () => ({ CloudApp: () => <p>Signed-in app</p> }))

afterEach(() => { cleanup(); vi.resetModules(); vi.clearAllMocks(); launch.auth = 'auth'; history.replaceState(null, '', '/') })
// The launch starts when the module loads, so each case loads the app afresh.
const open = async () => { const { default: App } = await import('@/App'); render(<App />) }
/** Opened from the Photo Brief card by `account`, in a browser that holds a Dronebrief session Toolkits made for `session`. */
const openFromToolkits = (account: string, session: string) => {
  history.replaceState(null, '', `/?plyo-connect=1&account=${account}`)
  launch.auth = { authStateReady: async () => {}, currentUser: { getIdTokenResult: async () => ({ claims: { plyo_accounts_uid: session } }) } }
  return open()
}

it('signs in with the Plyo Toolkits token for Dronebrief before showing the app', async () => {
  launch.continueToolLaunch.mockResolvedValue('custom-token')
  await open()
  expect(screen.getByRole('status')).toHaveTextContent('Signing in with Plyo Toolkits')
  expect(await screen.findByText('Signed-in app')).toBeInTheDocument()
  expect(launch.continueToolLaunch).toHaveBeenCalledWith('https://plyo-toolkits.web.app', 'https://plyo-toolkits.web.app/api/shared-login/redeem', expect.any(AbortSignal), 'dronebrief')
  expect(launch.signIn).toHaveBeenCalledWith('auth', 'custom-token')
})
it('keeps waiting while the browser leaves for Plyo Accounts', async () => {
  launch.continueToolLaunch.mockResolvedValue(null)
  await open()
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.getByRole('status')).toHaveTextContent('Signing in with Plyo Toolkits')
  expect(screen.queryByText('Signed-in app')).not.toBeInTheDocument()
  expect(launch.signIn).not.toHaveBeenCalled()
})
it('explains a refused launch without signing in and offers the ordinary app', async () => {
  document.documentElement.setAttribute('data-plyo-loading', '')
  launch.continueToolLaunch.mockRejectedValue(new Error('Access is not approved for this tool.'))
  await open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Access is not approved for this tool.')
  expect(screen.getByRole('link', { name: 'Continue to Dronebrief' })).toHaveAttribute('href', '/')
  expect(screen.queryByText('Signed-in app')).not.toBeInTheDocument()
  expect(launch.signIn).not.toHaveBeenCalled()
  expect(document.documentElement).not.toHaveAttribute('data-plyo-loading')
})
it('opens at once when Toolkits already signed this person in here, without leaving for Plyo Accounts', async () => {
  await openFromToolkits('plyo-account', 'plyo-account')
  expect(await screen.findByText('Signed-in app')).toBeInTheDocument()
  expect(launch.continueToolLaunch).not.toHaveBeenCalled()
  expect(launch.signIn).not.toHaveBeenCalled()
  expect(location.search).toBe('')
})
it('signs in through Plyo Accounts when the session here belongs to someone else', async () => {
  launch.continueToolLaunch.mockResolvedValue(null)
  await openFromToolkits('plyo-account', 'another-account')
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(launch.continueToolLaunch).toHaveBeenCalled()
  expect(screen.queryByText('Signed-in app')).not.toBeInTheDocument()
})

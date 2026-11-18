import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const launch = vi.hoisted(() => ({ continueToolLaunch: vi.fn(), signIn: vi.fn() }))
vi.mock('@/features/cloud/auth/config', () => ({ cloudConfigured: true }))
vi.mock('@plyo/accounts-client/tool-launch', () => ({ hasToolLaunch: () => true, continueToolLaunch: launch.continueToolLaunch }))
vi.mock('firebase/auth', () => ({ signInWithCustomToken: launch.signIn }))
vi.mock('@/features/cloud/auth/firebase', () => ({ firebase: () => ({ auth: 'auth' }) }))
vi.mock('@/pages/cloud-app', () => ({ CloudApp: () => <p>Signed-in app</p> }))

afterEach(() => { cleanup(); vi.resetModules(); vi.clearAllMocks() })
// The launch starts when the module loads, so each case loads the app afresh.
const open = async () => { const { default: App } = await import('@/App'); render(<App />) }

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
  launch.continueToolLaunch.mockRejectedValue(new Error('Access is not approved for this tool.'))
  await open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Access is not approved for this tool.')
  expect(screen.getByRole('link', { name: 'Continue to Dronebrief' })).toHaveAttribute('href', '/')
  expect(screen.queryByText('Signed-in app')).not.toBeInTheDocument()
  expect(launch.signIn).not.toHaveBeenCalled()
})

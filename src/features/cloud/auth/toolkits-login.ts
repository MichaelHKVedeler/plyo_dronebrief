import { continueToolLaunch, hasToolLaunch } from '@plyo/accounts-client/tool-launch'
import { cloudConfigured } from './config'

const accounts = 'https://plyo-toolkits.web.app'
async function signIn() {
  // Runs up to its first request at import: the launch leaves the URL before the hash is read as a route.
  const token = await continueToolLaunch(accounts, `${accounts}/api/shared-login/redeem`, new AbortController().signal, 'dronebrief')
  // No token yet: the browser is leaving for Plyo Accounts and returns with a one-time code.
  if (!token) return new Promise<never>(() => {})
  const [{ signInWithCustomToken }, { firebase }] = await Promise.all([import('firebase/auth'), import('./firebase')])
  await signInWithCustomToken(firebase().auth, token)
}
/** One attempt per page load when opened from Plyo Toolkits: resolves to null once signed in, or to why it failed. */
export const toolkitsSignIn = cloudConfigured && hasToolLaunch(location)
  ? signIn().then(() => null, (error: unknown) => (error instanceof Error && error.constructor === Error ? error.message : 'Sign-in from Plyo Toolkits could not be completed.'))
  : null

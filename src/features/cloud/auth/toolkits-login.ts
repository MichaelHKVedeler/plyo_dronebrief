import { canResumeToolSession, continueToolLaunch, hasToolLaunch } from '@plyo/accounts-client/tool-launch'
import { cloudConfigured } from './config'

const accounts = 'https://plyo-toolkits.web.app'
export const toolkitsUrl = `${accounts}/toolkits/`
async function signIn() {
  // Fetched while the launch is on the network, not after it.
  const sdk = Promise.all([import('firebase/auth'), import('./firebase')])
  if (new URLSearchParams(location.search).has('plyo-connect')) {
    // A session Toolkits made here names its Plyo account in a claim: people keep the UID they already had in Dronebrief.
    const account = await sdk.then(async ([, { firebase }]) => {
      const { auth } = firebase()
      await auth.authStateReady()
      return (await auth.currentUser?.getIdTokenResult())?.claims.plyo_accounts_uid
    }).catch(() => undefined)
    // Already signed in as the person Toolkits is sending: skip the trip to Plyo Accounts and back.
    if (typeof account === 'string' && canResumeToolSession(location, { uid: account })) { history.replaceState(null, '', location.pathname); return }
  }
  // Runs up to its first request at import: the launch leaves the URL before the hash is read as a route.
  const token = await continueToolLaunch(accounts, `${accounts}/api/shared-login/redeem`, new AbortController().signal, 'dronebrief')
  // No token yet: the browser is leaving for Plyo Accounts and returns with a one-time code.
  if (!token) return new Promise<never>(() => {})
  const [{ signInWithCustomToken }, { firebase }] = await sdk
  await signInWithCustomToken(firebase().auth, token)
}
/** One attempt per page load when opened from Plyo Toolkits: resolves to null once signed in, or to why it failed. */
export const toolkitsSignIn = cloudConfigured && hasToolLaunch(location)
  ? signIn().then(() => null, (error: unknown) => (error instanceof Error && error.constructor === Error ? error.message : 'Sign-in from Plyo Toolkits could not be completed.'))
  : null

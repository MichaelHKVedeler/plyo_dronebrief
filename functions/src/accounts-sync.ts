import { HttpsError } from 'firebase-functions/v2/https'

const BRIDGE = 'shared-login-bridge@plyo-accounts-prod.iam.gserviceaccount.com'
const AUDIENCE = 'https://plyo-dronebrief.web.app/accounts-sync'

// Only the sign-in service of production Plyo Accounts may send the member list. It proves itself with a Google-signed token made for this address.
export async function requireAccounts(authorization: string | undefined, request: typeof fetch = fetch) {
  const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(authorization ?? '')?.[1]
  if (!token) throw new HttpsError('unauthenticated', 'Sign-in is required.')
  // shortcut: Google checks the signature and expiry, one extra request per sync; verify locally with google-auth-library if syncs become frequent.
  const reply = await request(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`)
  const claims = reply.ok ? await reply.json() as Record<string, unknown> : {}
  if (claims.aud !== AUDIENCE || claims.email !== BRIDGE || String(claims.email_verified) !== 'true') throw new HttpsError('permission-denied', 'Not allowed.')
}

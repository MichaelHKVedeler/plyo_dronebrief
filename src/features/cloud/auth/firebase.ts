import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions'
import { cloudConfigured } from './config'

const env = import.meta.env
export const emulated = env.DEV && env.VITE_FIREBASE_EMULATORS === 'true'
// Sign-in and the API only: the editor adds Firestore (project-repository) and Storage (uploads) when it opens,
// so signing in and the library do not download them.
let services: { app: FirebaseApp; auth: Auth; functions: Functions } | undefined
export function firebase() {
  if (services) return services
  if (!cloudConfigured) throw new Error('Firebase is not configured. Follow docs/firebase-setup.md to enable cloud projects.')
  const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, appId: env.VITE_FIREBASE_APP_ID })
  const auth = getAuth(app); const functions = getFunctions(app, 'europe-west1')
  if (emulated) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }
  services = { app, auth, functions }
  return services
}
export async function callCloud<T>(operation: string, data: unknown = {}): Promise<T> {
  // Image processing has a function to itself (functions/src/index.ts); every other request shares one.
  const result = await httpsCallable<{ operation: string; data: unknown }, T>(firebase().functions, operation === 'finalizeUpload' ? 'processing' : 'api', { timeout: 300_000 })({ operation, data })
  return result.data
}
export function signInGoogle() { const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); return signInWithPopup(firebase().auth, provider) }
export function signOutGoogle() { return signOut(firebase().auth) }
export function publicEndpoint() {
  if (!cloudConfigured) throw new Error('Cloud projects are not configured.')
  return emulated ? `http://127.0.0.1:5001/${env.VITE_FIREBASE_PROJECT_ID}/europe-west1/publicView` : `https://europe-west1-${env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/publicView`
}
export function cloudError(error: unknown) { return error instanceof Error ? error.message.replace(/^Firebase:\s*/, '') : 'The request failed. Please retry.' }

import { connectFirestoreEmulator, doc, getFirestore, onSnapshot, type Firestore } from 'firebase/firestore'
import { emulated, firebase } from '../auth/firebase'

// On its own, and fetched by project-repository when a project opens: signing in and the library never download Firestore.
let db: Firestore | undefined
export function watchProject(projectId: string, onRevision: (revision: number) => void, onError: (error: Error) => void) {
  if (!db) { db = getFirestore(firebase().app); if (emulated) connectFirestoreEmulator(db, '127.0.0.1', 8080) }
  return onSnapshot(doc(db, 'projects', projectId), (snapshot) => { if (snapshot.exists()) onRevision(snapshot.get('revision') as number); else onError(new Error('Project unavailable.')) }, onError)
}

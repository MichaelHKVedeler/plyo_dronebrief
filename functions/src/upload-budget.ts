import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, hash } from './context.js'

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
export const USER_UPLOAD_BYTES_PER_DAY = 600 * 1024 * 1024
export const ORG_UPLOAD_BYTES_PER_DAY = 3 * 1024 * 1024 * 1024
export const MAX_PENDING_UPLOADS = 20
export const UPLOAD_RESERVATION_MS = 30 * 60_000
export const UPLOAD_PROCESSING_LEASE_MS = 10 * 60_000
export const MAX_UPLOAD_PROCESSING_ATTEMPTS = 3

// One private document per principal; changing the UTC day resets its counter.
// New uploads reserve their maximum permitted size; copies reserve the canonical
// source size. Neither charge is refunded after failure or abandonment.
export const uploadBudgetRef = (kind: 'user' | 'org', id: string) => db.doc(`uploadBudgets/${kind}-${hash(id)}`)
export async function reserveUploadBudget(tx: Transaction, uid: string, orgId: string, currentTime: number, bytes = MAX_UPLOAD_BYTES) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Invalid image reservation size.')
  const windowStart = Math.floor(currentTime / 86400_000) * 86400_000
  const limits = [
    { ref: uploadBudgetRef('user', uid), limit: USER_UPLOAD_BYTES_PER_DAY },
    { ref: uploadBudgetRef('org', orgId), limit: ORG_UPLOAD_BYTES_PER_DAY },
  ]
  const snapshots = await tx.getAll(...limits.map(({ ref }) => ref))
  const charges = snapshots.map((snapshot, index) => {
    const used = snapshot.get('windowStart') === windowStart ? snapshot.get('bytes') : 0
    if (!Number.isSafeInteger(used) || used < 0 || used + bytes > limits[index].limit) {
      throw new HttpsError('resource-exhausted', 'The daily image upload limit has been reached. Try again tomorrow.')
    }
    return used + bytes
  })
  limits.forEach(({ ref }, index) => tx.set(ref, { windowStart, bytes: charges[index], expiresAt: Timestamp.fromMillis(windowStart + 2 * 86400_000) }))
}

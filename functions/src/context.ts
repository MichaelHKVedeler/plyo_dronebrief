import { initializeApp } from 'firebase-admin/app'
import { getFirestore, type Transaction } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { createHash } from 'node:crypto'
import type { Actor, Membership, ProjectSummary } from '../../src/features/cloud/model/cloud.js'

initializeApp()
export const db = getFirestore()
export const bucket = () => getStorage().bucket()
export const now = () => new Date().toISOString()
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const emailKey = (email: string) => hash(email.trim().toLowerCase())
export function principal(request: CallableRequest): Actor & { email: string } {
  const auth = request.auth
  if (!auth || auth.token.email_verified !== true || auth.token.firebase?.sign_in_provider !== 'google.com' || typeof auth.token.email !== 'string') {
    throw new HttpsError('unauthenticated', 'Sign in with a verified Google account.')
  }
  return { uid: auth.uid, name: String(auth.token.name || 'Google user').trim().slice(0, 200) || 'Google user', email: auth.token.email.toLowerCase() }
}
export function denied(): never { throw new HttpsError('permission-denied', 'You do not have access to this organization or project.') }
export const memberRef = (orgId: string, uid: string) => db.doc(`organizations/${orgId}/members/${uid}`)
export const projectRef = (id: string) => db.doc(`projects/${id}`)
export async function requireMember(tx: Transaction, orgId: string, uid: string, admin = false): Promise<Membership> {
  const doc = await tx.get(memberRef(orgId, uid))
  if (!doc.exists || (admin && doc.get('role') !== 'admin')) denied()
  return doc.data() as Membership
}
export function canManage(project: ProjectSummary, member: Membership) { return project.createdBy.uid === member.uid || member.role === 'admin' }
export function requireActive(project: ProjectSummary) { if (project.deletedAt) throw new HttpsError('not-found', 'This project is in the trash.') }
export const actorOnly = ({ uid, name }: Actor): Actor => ({ uid, name })

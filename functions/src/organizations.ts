import { randomUUID } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { cloudId, cloudName, roleSchema, type Actor } from '../../src/features/cloud/model/cloud.js'
import { db, emailKey, memberRef, now, requireMember } from './context.js'

type Identity = Actor & { email: string }
export async function initializeAccount(user: Identity) {
  const grants = await db.collection(`emailGrants/${emailKey(user.email)}/organizations`).where('status', '==', 'pending').get()
  for (const candidate of grants.docs) await db.runTransaction(async (tx) => {
    const grant = await tx.get(candidate.ref)
    if (grant.get('status') !== 'pending' || grant.get('email') !== user.email) return
    const orgRef = db.doc(`organizations/${candidate.id}`)
    const org = await tx.get(orgRef)
    const member = await tx.get(memberRef(candidate.id, user.uid))
    if (!org.exists || member.exists) return
    const stamp = now()
    tx.set(memberRef(candidate.id, user.uid), { orgId: candidate.id, uid: user.uid, name: user.name, role: grant.get('role'), grantId: emailKey(user.email), joinedAt: stamp })
    tx.set(db.doc(`users/${user.uid}/organizations/${candidate.id}`), { id: candidate.id, name: org.get('name'), role: grant.get('role'), indexing: true })
    const next = { ...grant.data(), status: 'active', uid: user.uid, updatedAt: stamp }
    tx.set(candidate.ref, next)
    tx.set(orgRef.collection('grants').doc(emailKey(user.email)), next)
    if (grant.get('role') === 'admin') tx.update(orgRef, { adminCount: Number(org.get('adminCount')) + 1 })
    tx.set(db.doc(`indexJobs/${randomUUID()}`), { orgId: candidate.id, uid: user.uid, after: null, kind: 'member', createdAt: stamp })
  })
  await db.doc(`users/${user.uid}`).set({ name: user.name, email: user.email, lastSeenAt: now() }, { merge: true })
  const organizations = await db.collection(`users/${user.uid}/organizations`).get()
  return organizations.docs.map((doc) => doc.data())
}

export async function createOrganization(user: Identity, input: unknown) {
  const data = z.object({ sourceOrgId: cloudId, name: cloudName, operationId: z.uuid() }).parse(input)
  const id = data.operationId
  await db.runTransaction(async (tx) => {
    await requireMember(tx, data.sourceOrgId, user.uid, true)
    const target = db.doc(`organizations/${id}`)
    const existing = await tx.get(target)
    if (existing.exists) {
      if (existing.get('createdBy') !== user.uid) throw new HttpsError('already-exists', 'Organization already exists.')
      return
    }
    const stamp = now()
    const grant = { id: emailKey(user.email), email: user.email, role: 'admin', status: 'active', uid: user.uid, updatedAt: stamp, addedBy: user.uid }
    tx.create(target, { name: data.name, createdBy: user.uid, createdAt: stamp, adminCount: 1 })
    tx.set(memberRef(id, user.uid), { orgId: id, uid: user.uid, name: user.name, role: 'admin', joinedAt: stamp, grantId: grant.id })
    tx.set(db.doc(`users/${user.uid}/organizations/${id}`), { id, name: data.name, role: 'admin', indexing: false })
    tx.set(target.collection('grants').doc(grant.id), grant)
    tx.set(db.doc(`emailGrants/${grant.id}/organizations/${id}`), grant)
  })
  return { id }
}

export async function manageOrganization(user: Identity, input: unknown) {
  const data = z.object({ orgId: cloudId, action: z.enum(['list', 'add', 'role', 'remove']), email: z.email().optional(), grantId: cloudId.optional(), role: roleSchema.default('member') }).parse(input)
  return db.runTransaction(async (tx) => {
    await requireMember(tx, data.orgId, user.uid, true)
    const orgRef = db.doc(`organizations/${data.orgId}`)
    if (data.action === 'list') {
      const grants = await tx.get(orgRef.collection('grants'))
      const members = await tx.get(orgRef.collection('members'))
      return { grants: grants.docs.map((doc) => doc.data()), members: members.docs.map((doc) => doc.data()) }
    }
    const key = data.action === 'add' && data.email ? emailKey(data.email) : data.grantId
    if (!key) throw new HttpsError('invalid-argument', 'Choose an email or membership.')
    const ref = orgRef.collection('grants').doc(key)
    const previous = await tx.get(ref)
    const org = await tx.get(orgRef)
    if (data.action === 'add') {
      if (!data.email) throw new HttpsError('invalid-argument', 'Enter an email.')
      if (previous.exists && previous.get('status') !== 'revoked') throw new HttpsError('already-exists', 'This email already has access or is awaiting sign-in.')
      const grant = { id: key, email: data.email.trim().toLowerCase(), role: data.role, status: 'pending', uid: null, updatedAt: now(), addedBy: user.uid }
      tx.set(ref, grant); tx.set(db.doc(`emailGrants/${key}/organizations/${data.orgId}`), grant)
      return { ok: true }
    }
    if (!previous.exists || previous.get('status') === 'revoked') throw new HttpsError('not-found', 'Membership not found.')
    const uid = previous.get('uid') as string | null
    const active = previous.get('status') === 'active' && uid !== null
    const wasAdmin = active && previous.get('role') === 'admin'
    const willAdmin = active && data.action !== 'remove' && data.role === 'admin'
    const adminCount = Number(org.get('adminCount')) + Number(willAdmin) - Number(wasAdmin)
    if (active && adminCount < 1) throw new HttpsError('failed-precondition', 'The organization must retain an active administrator.')
    const next = { ...previous.data(), role: data.action === 'role' ? data.role : previous.get('role'), status: data.action === 'remove' ? 'revoked' : previous.get('status'), updatedAt: now(), changedBy: user.uid }
    tx.set(ref, next); tx.set(db.doc(`emailGrants/${key}/organizations/${data.orgId}`), next)
    if (active && uid) {
      if (data.action === 'remove') {
        tx.delete(memberRef(data.orgId, uid)); tx.delete(db.doc(`users/${uid}/organizations/${data.orgId}`))
      } else {
        tx.update(memberRef(data.orgId, uid), { role: data.role }); tx.update(db.doc(`users/${uid}/organizations/${data.orgId}`), { role: data.role })
      }
      tx.update(orgRef, { adminCount })
    }
    return { ok: true }
  })
}

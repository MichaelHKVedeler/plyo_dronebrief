import { randomUUID } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import type { Transaction } from 'firebase-admin/firestore'
import { z } from 'zod'
import { cloudId, cloudName, roleSchema, toolkitsOrganization, type Actor, type Grant } from '../../src/features/cloud/model/cloud.js'
import { db, emailKey, memberRef, now, requireMember } from './context.js'

type Identity = Actor & { email: string }
type Role = z.infer<typeof roleSchema>
type Change = { action: 'add' | 'role' | 'remove'; email?: string; grantId?: string; role: Role }
const PROFILE_REFRESH_MS = 15 * 60_000

async function refreshProfile(user: Identity) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${user.uid}`)
    const profile = await tx.get(ref)
    const lastSeen = Date.parse(String(profile.get('lastSeenAt') ?? ''))
    if (profile.get('name') === user.name && profile.get('email') === user.email
      && Number.isFinite(lastSeen) && Date.now() - lastSeen < PROFILE_REFRESH_MS) return
    tx.set(ref, { name: user.name, email: user.email, lastSeenAt: now() }, { merge: true })
  })
}

export async function initializeAccount(user: Identity) {
  const grants = await db.collection(`emailGrants/${emailKey(user.email)}/organizations`).where('status', '==', 'pending').get()
  for (const candidate of grants.docs) await db.runTransaction(async (tx) => {
    const grant = await tx.get(candidate.ref)
    if (grant.get('status') !== 'pending' || grant.get('email') !== user.email) return
    const orgRef = db.doc(`organizations/${candidate.id}`)
    const [org, member] = await tx.getAll(orgRef, memberRef(candidate.id, user.uid))
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
  const organizations = await db.collection(`users/${user.uid}/organizations`).get()
  // Uninvited Google accounts need an access result, not a persisted profile.
  if (!organizations.empty) await refreshProfile(user)
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
    if (data.orgId === toolkitsOrganization) throw new HttpsError('failed-precondition', 'Members of this organization are managed in Plyo Toolkits.')
    return changeGrant(tx, data.orgId, user.uid, { ...data, action: data.action })
  })
}

// system: Plyo Toolkits decides, so its changes may leave the organization without an active administrator.
async function changeGrant(tx: Transaction, orgId: string, actor: string, data: Change, system = false) {
  const orgRef = db.doc(`organizations/${orgId}`)
  const key = data.action === 'add' && data.email ? emailKey(data.email) : data.grantId
  if (!key) throw new HttpsError('invalid-argument', 'Choose an email or membership.')
  const ref = orgRef.collection('grants').doc(key)
  const previous = await tx.get(ref)
  const org = await tx.get(orgRef)
  if (data.action === 'add') {
    if (!data.email) throw new HttpsError('invalid-argument', 'Enter an email.')
    if (previous.exists && previous.get('status') !== 'revoked') throw new HttpsError('already-exists', 'This email already has access or is awaiting sign-in.')
    const grant = { id: key, email: data.email.trim().toLowerCase(), role: data.role, status: 'pending', uid: null, updatedAt: now(), addedBy: actor }
    tx.set(ref, grant); tx.set(db.doc(`emailGrants/${key}/organizations/${orgId}`), grant)
    return { ok: true }
  }
  if (!previous.exists || previous.get('status') === 'revoked') throw new HttpsError('not-found', 'Membership not found.')
  const uid = previous.get('uid') as string | null
  const active = previous.get('status') === 'active' && uid !== null
  const wasAdmin = active && previous.get('role') === 'admin'
  const willAdmin = active && data.action !== 'remove' && data.role === 'admin'
  const adminCount = Number(org.get('adminCount')) + Number(willAdmin) - Number(wasAdmin)
  if (active && adminCount < 1 && !system) throw new HttpsError('failed-precondition', 'The organization must retain an active administrator.')
  const next = { ...previous.data(), role: data.action === 'role' ? data.role : previous.get('role'), status: data.action === 'remove' ? 'revoked' : previous.get('status'), updatedAt: now(), changedBy: actor }
  tx.set(ref, next); tx.set(db.doc(`emailGrants/${key}/organizations/${orgId}`), next)
  if (active && uid) {
    if (data.action === 'remove') {
      tx.delete(memberRef(orgId, uid)); tx.delete(db.doc(`users/${uid}/organizations/${orgId}`))
    } else {
      tx.update(memberRef(orgId, uid), { role: data.role }); tx.update(db.doc(`users/${uid}/organizations/${orgId}`), { role: data.role })
    }
    tx.update(orgRef, { adminCount })
  }
  return { ok: true }
}

// What turns the grants an organization has into the member list it should have.
export function membershipChanges(grants: Pick<Grant, 'id' | 'role' | 'status'>[], wanted: { email: string; role: Role }[]): Change[] {
  const current = new Map(grants.filter((grant) => grant.status !== 'revoked').map((grant) => [grant.id, grant.role]))
  const next = new Map(wanted.map((member) => [emailKey(member.email), member]))
  return [
    ...[...next].filter(([id, member]) => current.get(id) !== member.role).map(([id, member]): Change => current.has(id) ? { action: 'role', grantId: id, role: member.role } : { action: 'add', email: member.email, role: member.role }),
    ...[...current.keys()].filter((id) => !next.has(id)).map((id): Change => ({ action: 'remove', grantId: id, role: 'member' })),
  ]
}

// Plyo Toolkits sends everyone who should be in the Plyo organization; this makes it so.
export async function syncOrganization(wanted: { email: string; role: Role }[]) {
  const grants = await db.collection(`organizations/${toolkitsOrganization}/grants`).get()
  const changes = membershipChanges(grants.docs.map((doc) => doc.data() as Grant), wanted)
  // One transaction each, as for a change made by hand: the grant, the membership and the administrator count stay together.
  for (const change of changes) await db.runTransaction((tx) => changeGrant(tx, toolkitsOrganization, 'plyo-toolkits', change, true))
  return { changed: changes.length }
}

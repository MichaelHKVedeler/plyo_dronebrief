import { randomUUID } from 'node:crypto'
import { FieldPath, type Query } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { cloudId, cloudName, libraryQuerySchema, namePrefixes, normalizeName, summarySchema, type Actor, type ProjectSummary } from '../../src/features/cloud/model/cloud.js'
import { db, hash, memberRef, now, projectRef, requireMember } from './context.js'

export async function updateProjection(uid: string, projectId: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${uid}/library/${projectId}`)
    const project = await tx.get(projectRef(projectId))
    if (!project.exists) { tx.delete(ref); return }
    const summary = summarySchema.parse(project.data())
    const member = await tx.get(memberRef(summary.orgId, uid))
    if (!member.exists) { tx.delete(ref); return }
    const settings = await tx.get(db.doc(`users/${uid}/projectSettings/${projectId}`))
    const collectionId = settings.get('collectionId') as string | null | undefined
    const collection = collectionId ? await tx.get(db.doc(`users/${uid}/collections/${collectionId}`)) : null
    const collectionName = collection?.exists ? String(collection.get('name')) : ''
    const item = { ...summary, collectionId: collection?.exists ? collectionId! : null, collectionName }
    tx.set(ref, { ...item, deleted: Boolean(summary.deletedAt), nameSort: normalizeName(summary.name), creatorSort: normalizeName(summary.createdBy.name), prefixes: namePrefixes([summary.name, summary.clientName, summary.createdBy.name, summary.editedBy.name, collectionName]) })
  })
}

export async function processIndexJob(id: string) {
  const ref = db.doc(`indexJobs/${id}`)
  const job = await ref.get()
  if (!job.exists) return
  const data = job.data()!
  let query: Query
  if (data.kind === 'project') query = db.collection(`organizations/${data.orgId}/members`)
  else if (data.kind === 'collection') query = db.collection(`users/${data.uid}/library`).where('collectionId', '==', data.collectionId)
  else query = db.collection('projects').where('orgId', '==', data.orgId)
  query = query.orderBy(FieldPath.documentId()).limit(100)
  if (data.after) query = query.startAfter(data.after)
  const docs = await query.get()
  for (let i = 0; i < docs.docs.length; i += 10) await Promise.all(docs.docs.slice(i, i + 10).map((doc) => updateProjection(data.kind === 'project' ? doc.id : data.uid, data.kind === 'project' ? data.projectId : doc.id)))
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref)
    if (!current.exists) return
    const membership = data.kind === 'member' ? await tx.get(db.doc(`users/${data.uid}/organizations/${data.orgId}`)) : null
    if (docs.size === 100) tx.set(db.doc(`indexJobs/${hash(id + ':' + docs.docs.at(-1)!.id)}`), { ...data, after: docs.docs.at(-1)!.id })
    else if (membership?.exists) tx.update(membership.ref, { indexing: false })
    tx.delete(ref)
  })
}

export async function listLibrary(user: Actor, input: unknown) {
  const data = libraryQuerySchema.parse(input)
  await db.runTransaction((tx) => requireMember(tx, data.orgId, user.uid, data.view === 'trash'))
  const creator = data.view === 'mine' ? user.uid : data.creatorId
  if (data.view === 'mine' && data.creatorId && data.creatorId !== user.uid) return { projects: [], cursor: null, indexing: false }
  const sort = { name: 'nameSort', creator: 'creatorSort', updated: 'updatedAt' }[data.sort]
  let query: Query = db.collection(`users/${user.uid}/library`).where('orgId', '==', data.orgId).where('deleted', '==', data.view === 'trash')
  if (creator) query = query.where('createdBy.uid', '==', creator)
  if (data.collectionId) query = query.where('collectionId', '==', data.collectionId)
  if (data.search) query = query.where('prefixes', 'array-contains', normalizeName(data.search))
  query = query.orderBy(sort, data.direction).orderBy(FieldPath.documentId(), data.direction)
  const signature = hash(JSON.stringify({ ...data, cursor: null, uid: user.uid }))
  if (data.cursor) {
    let cursor: { signature: string; value: string; id: string }
    try { cursor = z.object({ signature: z.string(), value: z.string().max(300), id: cloudId }).parse(JSON.parse(Buffer.from(data.cursor, 'base64url').toString())) } catch { throw new HttpsError('invalid-argument', 'Invalid search cursor.') }
    if (cursor.signature !== signature) throw new HttpsError('invalid-argument', 'Search filters changed. Start from the first page.')
    query = query.startAfter(cursor.value, cursor.id)
  }
  const page = await query.limit(51).get()
  const documents = page.docs.slice(0, 50)
  // An index is not an authorization boundary. Recheck membership and project state at response time.
  const projects = await db.runTransaction(async (tx) => {
    await requireMember(tx, data.orgId, user.uid, data.view === 'trash')
    const current = documents.length ? await tx.getAll(...documents.map((doc) => projectRef(doc.id))) : []
    return current.flatMap((doc, i): ProjectSummary[] => {
      if (!doc.exists || doc.get('orgId') !== data.orgId || Boolean(doc.get('deletedAt')) !== (data.view === 'trash')) return []
      const item = summarySchema.parse(doc.data())
      if (creator && item.createdBy.uid !== creator) return []
      return [{ ...item, collectionId: documents[i].get('collectionId'), collectionName: documents[i].get('collectionName') }]
    })
  })
  const last = documents.at(-1)
  const cursor = page.size > 50 && last ? Buffer.from(JSON.stringify({ signature, value: last.get(sort), id: last.id })).toString('base64url') : null
  const membership = await db.doc(`users/${user.uid}/organizations/${data.orgId}`).get()
  return { projects, cursor, indexing: membership.get('indexing') === true }
}

export async function collections(user: Actor, input: unknown) {
  const data = z.object({ orgId: cloudId, action: z.enum(['list', 'create', 'rename', 'delete', 'assign']), id: cloudId.optional(), projectId: cloudId.optional(), name: cloudName.optional() }).parse(input)
  const result = await db.runTransaction(async (tx) => {
    await requireMember(tx, data.orgId, user.uid)
    const own = db.collection(`users/${user.uid}/collections`)
    if (data.action === 'list') {
      const docs = await tx.get(own.where('orgId', '==', data.orgId))
      const members = await tx.get(db.collection(`organizations/${data.orgId}/creators`))
      return { collections: docs.docs.map((doc) => ({ id: doc.id, ...doc.data() })), creators: members.docs.map((doc) => ({ uid: doc.id, name: doc.get('name') })) }
    }
    if (data.action === 'create') {
      if (!data.name || !data.id) throw new HttpsError('invalid-argument', 'Name and operation ID required.')
      const previous = await tx.get(own.doc(data.id))
      if (previous.exists && (previous.get('orgId') !== data.orgId || previous.get('name') !== data.name)) throw new HttpsError('already-exists', 'Collection operation was already used.')
      if (!previous.exists) tx.create(own.doc(data.id), { orgId: data.orgId, name: data.name })
      return { ok: true }
    }
    const selected = data.id ? await tx.get(own.doc(data.id)) : null
    if (data.id && (!selected?.exists || selected.get('orgId') !== data.orgId)) throw new HttpsError('not-found', 'Collection unavailable.')
    if (data.action === 'assign') {
      if (!data.projectId) throw new HttpsError('invalid-argument', 'Project required.')
      const project = await tx.get(projectRef(data.projectId))
      if (!project.exists || project.get('orgId') !== data.orgId) throw new HttpsError('not-found', 'Project unavailable.')
      tx.set(db.doc(`users/${user.uid}/projectSettings/${data.projectId}`), { collectionId: data.id ?? null, orgId: data.orgId })
      return { ok: true }
    }
    if (!selected) throw new HttpsError('invalid-argument', 'Collection required.')
    if (data.action === 'delete') tx.delete(selected.ref)
    else { if (!data.name) throw new HttpsError('invalid-argument', 'Name required.'); tx.update(selected.ref, { name: data.name }) }
    tx.create(db.doc(`indexJobs/${randomUUID()}`), { kind: 'collection', uid: user.uid, orgId: data.orgId, collectionId: data.id, after: null, createdAt: now() })
    return { ok: true }
  })
  if (data.action === 'assign' && data.projectId) await updateProjection(user.uid, data.projectId)
  return result
}

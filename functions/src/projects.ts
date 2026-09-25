import { z } from 'zod'
import { HttpsError } from 'firebase-functions/v2/https'
import { cloudId, cloudName, summarySchema, type Actor, type CloudProject, type AssetManifest } from '../../src/features/cloud/model/cloud.js'
import { editorMapView } from '../../src/features/cloud/model/map-view.js'
import { eraseProject } from './cleanup.js'
import { db, hash, projectRef, requireMember, requireActive, canManage, now, actorOnly, denied } from './context.js'
import { bodySchema, encodeBody, readBody, writeBody, type ProjectBody } from './body.js'
import type { Transaction } from 'firebase-admin/firestore'

export async function validateAssets(tx: Transaction, projectId: string, orgId: string, body: ProjectBody) {
  const used = new Set(body.brief.imageOverlays.flatMap((image) => typeof image.source === 'string' ? [] : [image.source.fileId]))
  const canonical: AssetManifest = {}
  for (const fileId of used) {
    const asset = body.assets[fileId]
    if (!asset || asset.projectId !== projectId || asset.orgId !== orgId || asset.fileId !== fileId) throw new HttpsError('failed-precondition', 'Upload every local floorplan before saving this project.')
    const stored = await tx.get(projectRef(projectId).collection('assets').doc(asset.id))
    if (!stored.exists || stored.get('state') !== 'ready' || stored.get('fileId') !== fileId) throw new HttpsError('failed-precondition', 'A floorplan is not ready. Upload it again.')
    const { state: _state, ...saved } = stored.data()!
    canonical[fileId] = saved as AssetManifest[string]
  }
  return canonical
}
export async function createProject(user: Actor, input: unknown): Promise<CloudProject> {
  const data = bodySchema.extend({ orgId: cloudId, operationId: z.uuid() }).parse(input)
  const id = hash(user.uid + ':' + data.operationId)
  const ref = projectRef(id)
  encodeBody(data)
  return db.runTransaction(async (tx) => {
    await requireMember(tx, data.orgId, user.uid)
    const doc = await tx.get(ref)
    if (doc.exists) {
      if (doc.get('createdBy.uid') !== user.uid || doc.get('orgId') !== data.orgId) denied()
      requireActive(summarySchema.parse(doc.data()))
      return { envelopeVersion: 1, summary: summarySchema.parse(doc.data()), ...await readBody(tx, ref, doc.get('chunkCount')) }
    }
    const assets = await validateAssets(tx, id, data.orgId, data)
    const stamp = now()
    const summary = { id, orgId: data.orgId, name: data.brief.project.name, clientName: data.brief.project.clientName, createdBy: actorOnly(user), editedBy: actorOnly(user), createdAt: stamp, updatedAt: stamp, revision: 1, deletedAt: null, collectionId: null, collectionName: '', map: editorMapView(data.brief) }
    const body = { brief: data.brief, assets }
    const chunkCount = writeBody(tx, ref, body)
    tx.create(ref, { ...summary, envelopeVersion: 1, chunkCount, assetIds: Object.values(assets).map((a) => a.id) })
    tx.set(db.doc(`organizations/${data.orgId}/creators/${user.uid}`), actorOnly(user))
    return { envelopeVersion: 1, summary, ...body }
  })
}
export async function loadProject(user: Actor, input: unknown): Promise<CloudProject> {
  const { projectId } = z.object({ projectId: cloudId }).parse(input)
  const ref = projectRef(projectId)
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (!doc.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(doc.data())
    await requireMember(tx, summary.orgId, user.uid)
    requireActive(summary)
    return { envelopeVersion: 1, summary, ...await readBody(tx, ref, doc.get('chunkCount')) }
  })
}
export async function saveProject(user: Actor, input: unknown) {
  const data = bodySchema.extend({ projectId: cloudId, expectedRevision: z.number().int().positive(), operationId: z.uuid() }).parse(input)
  encodeBody(data)
  const fingerprint = hash(JSON.stringify(data))
  const ref = projectRef(data.projectId)
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (!doc.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const previous = summarySchema.parse(doc.data())
    await requireMember(tx, previous.orgId, user.uid)
    requireActive(previous)
    const receipt = ref.collection('operations').doc(hash(user.uid + data.operationId))
    const saved = await tx.get(receipt)
    if (saved.exists) {
      if (saved.get('fingerprint') !== fingerprint) throw new HttpsError('invalid-argument', 'This operation ID was already used for different changes.')
      return summarySchema.parse(saved.get('summary'))
    }
    if (previous.revision !== data.expectedRevision) throw new HttpsError('aborted', 'Someone else saved this project. Your changes have been preserved.', { revision: previous.revision })
    const assets = await validateAssets(tx, data.projectId, previous.orgId, data)
    const summary = { ...previous, name: data.brief.project.name, clientName: data.brief.project.clientName, editedBy: actorOnly(user), updatedAt: now(), revision: previous.revision + 1, map: editorMapView(data.brief) }
    const chunkCount = writeBody(tx, ref, { brief: data.brief, assets }, doc.get('chunkCount'))
    tx.update(ref, { ...summary, chunkCount, assetIds: Object.values(assets).map((a) => a.id) })
    tx.create(receipt, { fingerprint, summary, createdAt: now() })
    return summary
  })
}
export async function trashProject(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, restore: z.boolean().default(false) }).parse(input)
  return db.runTransaction(async (tx) => {
    const ref = projectRef(data.projectId)
    const doc = await tx.get(ref)
    if (!doc.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const project = summarySchema.parse(doc.data())
    const member = await requireMember(tx, project.orgId, user.uid, data.restore)
    const privateRef = db.doc(`projectPrivate/${data.projectId}`)
    const privateDoc = await tx.get(privateRef)
    if (!data.restore && !canManage(project, member)) denied()
    if (data.restore && project.deletedAt && Date.parse(project.deletedAt) <= Date.now() - 30 * 86400_000) throw new HttpsError('failed-precondition', 'The recovery period has ended.')
    if (doc.get('purging')) throw new HttpsError('failed-precondition', 'This project is being permanently deleted.')
    if (Boolean(project.deletedAt) === !data.restore) return { ok: true }
    tx.update(ref, { deletedAt: data.restore ? null : now(), deletedBy: data.restore ? null : user.uid, revision: project.revision + 1 })
    const share = privateDoc.get('shareToken') as string | undefined
    if (share) { tx.delete(db.doc(`publicShares/${share}`)); tx.set(privateRef, { shareToken: null }) }
    return { ok: true }
  })
}
export async function purgeProject(user: Actor, input: unknown) {
  const { projectId } = z.object({ projectId: cloudId }).parse(input)
  const orgId = await db.runTransaction(async (tx) => {
    const ref = projectRef(projectId)
    const doc = await tx.get(ref)
    if (!doc.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const project = summarySchema.parse(doc.data())
    await requireMember(tx, project.orgId, user.uid, true)
    if (!project.deletedAt) throw new HttpsError('failed-precondition', 'Move this project to Deleted projects before deleting it permanently.')
    if (!doc.get('purging')) tx.update(ref, { purging: true })
    return project.orgId
  })
  await eraseProject(projectId, orgId)
  return { ok: true }
}
export async function renameProject(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, name: cloudName }).parse(input)
  return db.runTransaction(async (tx) => {
    const ref = projectRef(data.projectId)
    const doc = await tx.get(ref)
    if (!doc.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const previous = summarySchema.parse(doc.data())
    await requireMember(tx, previous.orgId, user.uid)
    requireActive(previous)
    if (doc.get('purging')) throw new HttpsError('failed-precondition', 'This project is being permanently deleted.')
    if (previous.name === data.name) return previous
    const stamp = now()
    const body = await readBody(tx, ref, doc.get('chunkCount'))
    const chunkCount = writeBody(tx, ref, { brief: { ...body.brief, updatedAt: stamp, project: { ...body.brief.project, name: data.name } }, assets: body.assets }, doc.get('chunkCount'))
    const summary = { ...previous, name: data.name, editedBy: actorOnly(user), updatedAt: stamp, revision: previous.revision + 1 }
    tx.update(ref, { name: summary.name, editedBy: summary.editedBy, updatedAt: stamp, revision: summary.revision, chunkCount })
    return summary
  })
}

import { z } from 'zod'
import { HttpsError } from 'firebase-functions/v2/https'
import { assetSchema, cloudId, summarySchema, type Actor } from '../../src/features/cloud/model/cloud.js'
import { bucket, db, projectRef, requireActive, requireMember, now } from './context.js'
import { optimizeFloorplan } from './optimize-floorplan.js'

const assetRequest = z.object({ projectId: cloudId, assetId: z.uuid(), fileId: z.uuid(), fileName: z.string().min(1).max(255) })
export async function prepareUpload(user: Actor, input: unknown) {
  const data = assetRequest.parse(input)
  return db.runTransaction(async (tx) => {
    const project = await tx.get(projectRef(data.projectId))
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    await requireMember(tx, summary.orgId, user.uid); requireActive(summary)
    const ref = project.ref.collection('assets').doc(data.assetId)
    const previous = await tx.get(ref)
    if (previous.exists && previous.get('uploadedBy') !== user.uid && previous.get('state') !== 'ready') throw new HttpsError('permission-denied', 'Upload belongs to another user.')
    if (!previous.exists) tx.create(ref, { id: data.assetId, fileId: data.fileId, fileName: data.fileName, projectId: data.projectId, orgId: summary.orgId, uploadedBy: user.uid, state: 'uploading', createdAt: now() })
    return { path: `organizations/${summary.orgId}/projects/${data.projectId}/staging/${data.assetId}` }
  })
}

export async function finalizeUpload(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, assetId: z.uuid() }).parse(input)
  const ref = projectRef(data.projectId).collection('assets').doc(data.assetId)
  const pending = await db.runTransaction(async (tx) => {
    const project = await tx.get(projectRef(data.projectId))
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    await requireMember(tx, summary.orgId, user.uid); requireActive(summary)
    const asset = await tx.get(ref)
    if (!asset.exists || (asset.get('state') !== 'ready' && asset.get('uploadedBy') !== user.uid)) throw new HttpsError('permission-denied', 'Upload unavailable.')
    if (!['uploading', 'ready'].includes(asset.get('state'))) throw new HttpsError('failed-precondition', 'Upload expired. Upload it again.')
    if (asset.get('state') === 'uploading') tx.update(ref, { processingUntil: new Date(Date.now() + 10 * 60_000).toISOString() })
    return asset.data()!
  })
  if (pending.state === 'ready') return assetSchema.parse(pending)
  const staging = bucket().file(`organizations/${pending.orgId}/projects/${data.projectId}/staging/${data.assetId}`)
  const [metadata] = await staging.getMetadata()
  if (Number(metadata.size) > 30 * 1024 * 1024) throw new HttpsError('invalid-argument', 'Choose an image smaller than 30 MB.')
  const [inputBytes] = await staging.download()
  let optimized: Awaited<ReturnType<typeof optimizeFloorplan>>
  try { optimized = await optimizeFloorplan(inputBytes) } catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'The image could not be optimized.') }
  const path = `organizations/${pending.orgId}/projects/${data.projectId}/floorplans/${data.assetId}.webp`
  const asset = assetSchema.parse({ ...pending, path, contentType: 'image/webp', width: optimized.width, height: optimized.height, originalWidth: optimized.originalWidth, originalHeight: optimized.originalHeight, originalSize: inputBytes.length, size: optimized.bytes.length, optimizerVersion: 1 })
  try {
    await bucket().file(path).save(optimized.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } })
  } catch (error) { if ((error as { code?: number }).code !== 412) throw error }
  const result = await db.runTransaction(async (tx) => {
    const project = await tx.get(projectRef(data.projectId))
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    await requireMember(tx, summary.orgId, user.uid); requireActive(summary)
    const current = await tx.get(ref)
    if (current.get('state') === 'ready') return assetSchema.parse(current.data())
    if (current.get('state') !== 'uploading') throw new HttpsError('failed-precondition', 'Upload expired.')
    tx.set(ref, { ...asset, state: 'ready' })
    return asset
  })
  // Cleanup is also retried by the scheduled janitor; an acknowledged asset stays usable.
  await staging.delete({ ignoreNotFound: true }).catch(() => undefined)
  return result
}

export async function copyAsset(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, sourceProjectId: cloudId, assetId: z.uuid() }).parse(input)
  const asset = await db.runTransaction(async (tx) => {
    const source = await tx.get(projectRef(data.sourceProjectId))
    const target = await tx.get(projectRef(data.projectId))
    if (!source.exists || !target.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const from = summarySchema.parse(source.data()); const to = summarySchema.parse(target.data())
    await requireMember(tx, from.orgId, user.uid); await requireMember(tx, to.orgId, user.uid)
    requireActive(from); requireActive(to)
    const original = await tx.get(source.ref.collection('assets').doc(data.assetId))
    if (original.get('state') !== 'ready') throw new HttpsError('permission-denied', 'Floorplan unavailable.')
    const existing = await tx.get(target.ref.collection('assets').doc(data.assetId))
    if (existing.exists && existing.get('state') !== 'ready') throw new HttpsError('failed-precondition', 'Floorplan copy is unavailable. Try a new project.')
    return { original: assetSchema.parse(original.data()), orgId: to.orgId, existing: existing.exists ? assetSchema.parse(existing.data()) : null }
  })
  if (asset.existing) return asset.existing
  const path = `organizations/${asset.orgId}/projects/${data.projectId}/floorplans/${data.assetId}.webp`
  const [bytes] = await bucket().file(asset.original.path).download()
  try { await bucket().file(path).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } }) } catch (error) { if ((error as { code?: number }).code !== 412) throw error }
  const result = { ...asset.original, path, projectId: data.projectId, orgId: asset.orgId, createdAt: now() }
  return db.runTransaction(async (tx) => {
    const source = await tx.get(projectRef(data.sourceProjectId)); const target = await tx.get(projectRef(data.projectId))
    if (!source.exists || !target.exists) throw new HttpsError('not-found', 'Project unavailable.')
    await requireMember(tx, source.get('orgId'), user.uid); await requireMember(tx, target.get('orgId'), user.uid)
    requireActive(summarySchema.parse(source.data())); requireActive(summarySchema.parse(target.data()))
    const original = await tx.get(source.ref.collection('assets').doc(data.assetId))
    const existing = await tx.get(target.ref.collection('assets').doc(data.assetId))
    if (original.get('state') !== 'ready') throw new HttpsError('permission-denied', 'Floorplan unavailable.')
    if (existing.get('state') === 'ready') return assetSchema.parse(existing.data())
    if (existing.exists) throw new HttpsError('failed-precondition', 'Floorplan copy is unavailable.')
    tx.set(target.ref.collection('assets').doc(data.assetId), { ...result, state: 'ready' })
    return result
  })
}

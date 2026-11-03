import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { assetSchema, cloudId, summarySchema, type Actor } from '../../src/features/cloud/model/cloud.js'
import { bucket, db, hash, projectRef, requireActive, requireMember, now } from './context.js'
import { optimizeFloorplan } from './optimize-floorplan.js'
import { MAX_PENDING_UPLOADS, MAX_UPLOAD_BYTES, MAX_UPLOAD_PROCESSING_ATTEMPTS, UPLOAD_PROCESSING_LEASE_MS, UPLOAD_RESERVATION_MS, reserveUploadBudget } from './upload-budget.js'

const assetRequest = z.object({ projectId: cloudId, assetId: z.uuid(), fileId: z.uuid(), fileName: z.string().min(1).max(255) })
type UploadReservation = { uid: string; maxBytes: number; expiresAt: Timestamp }
export async function prepareUpload(user: Actor, input: unknown) {
  const data = assetRequest.parse(input)
  return db.runTransaction(async (tx) => {
    const project = await tx.get(projectRef(data.projectId))
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    await requireMember(tx, summary.orgId, user.uid); requireActive(summary)
    const ref = project.ref.collection('assets').doc(data.assetId)
    const previous = await tx.get(ref)
    const currentTime = Date.now()
    const reservations = (project.get('pendingUploads') ?? {}) as Record<string, UploadReservation>
    const path = `organizations/${summary.orgId}/projects/${data.projectId}/staging/${data.assetId}`
    if (previous.exists) {
      if (previous.get('state') !== 'uploading') throw new HttpsError('failed-precondition', 'Upload expired or already completed. Choose the file again.')
      if (previous.get('uploadedBy') !== user.uid) throw new HttpsError('permission-denied', 'Upload belongs to another user.')
      if (previous.get('fileId') !== data.fileId || previous.get('fileName') !== data.fileName || previous.get('projectId') !== data.projectId || previous.get('orgId') !== summary.orgId) {
        throw new HttpsError('invalid-argument', 'This upload identifier was already used for another file.')
      }
      const reservation = reservations[data.assetId]
      if (reservation?.uid !== user.uid || !(reservation.expiresAt instanceof Timestamp) || reservation.expiresAt.toMillis() <= currentTime) {
        throw new HttpsError('failed-precondition', 'Upload expired or already completed. Choose the file again.')
      }
      return { path }
    }
    const pendingUploads = Object.fromEntries(Object.entries(reservations).filter(([, reservation]) => reservation.expiresAt instanceof Timestamp && reservation.expiresAt.toMillis() > currentTime))
    if (Object.keys(pendingUploads).length >= MAX_PENDING_UPLOADS) throw new HttpsError('resource-exhausted', 'Too many image uploads are pending. Finish them or try again later.')
    await reserveUploadBudget(tx, user.uid, summary.orgId, currentTime)
    const expiresAt = Timestamp.fromMillis(currentTime + UPLOAD_RESERVATION_MS)
    pendingUploads[data.assetId] = { uid: user.uid, maxBytes: MAX_UPLOAD_BYTES, expiresAt }
    tx.update(project.ref, { pendingUploads })
    tx.create(ref, { id: data.assetId, fileId: data.fileId, fileName: data.fileName, projectId: data.projectId, orgId: summary.orgId, uploadedBy: user.uid, state: 'uploading', createdAt: now(), uploadExpiresAt: expiresAt })
    return { path }
  })
}

export async function finalizeUpload(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, assetId: z.uuid() }).parse(input)
  const ref = projectRef(data.projectId).collection('assets').doc(data.assetId)
  const processingToken = randomUUID()
  const pending = await db.runTransaction(async (tx) => {
    const project = await tx.get(projectRef(data.projectId))
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    await requireMember(tx, summary.orgId, user.uid); requireActive(summary)
    const asset = await tx.get(ref)
    if (!asset.exists || (asset.get('state') !== 'ready' && asset.get('uploadedBy') !== user.uid)) throw new HttpsError('permission-denied', 'Upload unavailable.')
    if (!['uploading', 'ready'].includes(asset.get('state'))) throw new HttpsError('failed-precondition', 'Upload expired. Upload it again.')
    if (asset.get('state') === 'uploading') {
      if (asset.get('processingUntil') > now()) throw new HttpsError('aborted', 'This image is still being processed. Retry shortly.')
      const attempts = Number(asset.get('processingAttempts') ?? 0)
      if (!Number.isSafeInteger(attempts) || attempts >= MAX_UPLOAD_PROCESSING_ATTEMPTS) throw new HttpsError('resource-exhausted', 'This image could not be processed. Choose the file again.')
      tx.update(ref, { processingToken, processingAttempts: attempts + 1, processingUntil: new Date(Date.now() + UPLOAD_PROCESSING_LEASE_MS).toISOString() })
    }
    return asset.data()!
  })
  if (pending.state === 'ready') return assetSchema.parse(pending)
  const staging = bucket().file(`organizations/${pending.orgId}/projects/${data.projectId}/staging/${data.assetId}`)
  try {
  const [metadata] = await staging.getMetadata()
  // A completed upload can be processed after expiry, but a resumable session
  // must not extend its authority to create a new original indefinitely.
  const uploadedAt = Date.parse(metadata.timeCreated ?? '')
  if (!(pending.uploadExpiresAt instanceof Timestamp) || !Number.isFinite(uploadedAt) || uploadedAt > pending.uploadExpiresAt.toMillis()) throw new HttpsError('invalid-argument', 'Upload expired. Choose the file again.')
  if (metadata.contentEncoding && metadata.contentEncoding !== 'identity') throw new HttpsError('invalid-argument', 'Encoded uploads are not supported. Choose the original JPG or PNG file.')
  if (!Number.isSafeInteger(Number(metadata.size)) || Number(metadata.size) <= 0 || Number(metadata.size) > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Choose an image smaller than 30 MB.')
  const [inputBytes] = await staging.download({ decompress: false })
  if (inputBytes.length < 1 || inputBytes.length > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Choose an image smaller than 30 MB.')
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
    if (current.get('state') !== 'uploading' || current.get('processingToken') !== processingToken) throw new HttpsError('failed-precondition', 'Upload expired.')
    tx.set(ref, { ...asset, state: 'ready' })
    // Revoke creation before deleting the original so its identifier cannot be reused.
    tx.update(project.ref, { [`pendingUploads.${data.assetId}`]: FieldValue.delete() })
    return asset
  })
  // Cleanup is also retried by the scheduled janitor; an acknowledged asset stays usable.
  await staging.delete({ ignoreNotFound: true }).catch(() => undefined)
  return result
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref)
      const project = await tx.get(projectRef(data.projectId))
      if (current.get('state') !== 'uploading' || current.get('processingToken') !== processingToken) return
      const invalid = error instanceof HttpsError && error.code === 'invalid-argument'
      tx.update(ref, { processingToken: FieldValue.delete(), processingUntil: FieldValue.delete(), ...(invalid ? { state: 'failed' } : {}) })
      if (invalid && project.exists) tx.update(project.ref, { [`pendingUploads.${data.assetId}`]: FieldValue.delete() })
    }).catch(() => undefined)
    throw error
  }
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
    const canonical = assetSchema.parse(original.data())
    const sourceFingerprint = hash(JSON.stringify(canonical))
    const path = `organizations/${to.orgId}/projects/${data.projectId}/floorplans/${data.assetId}.webp`
    if (existing.get('state') === 'ready') return { original: canonical, sourceFingerprint, result: assetSchema.parse(existing.data()), ready: true }
    if (existing.exists) {
      if (existing.get('state') !== 'copying' || existing.get('copiedBy') !== user.uid || existing.get('sourceProjectId') !== data.sourceProjectId || existing.get('sourceFingerprint') !== sourceFingerprint || existing.get('path') !== path || existing.get('fileId') !== canonical.fileId) {
        throw new HttpsError('failed-precondition', 'Floorplan copy belongs to a different operation. Try a new project.')
      }
      return { original: canonical, sourceFingerprint, result: assetSchema.parse(existing.data()), ready: false }
    }
    await reserveUploadBudget(tx, user.uid, to.orgId, Date.now(), canonical.size)
    const result = assetSchema.parse({ ...canonical, path, projectId: data.projectId, orgId: to.orgId, createdAt: now() })
    // Retain the charged operation before I/O so a failed copy can retry without
    // charging again or letting a different source/user adopt its reservation.
    tx.create(target.ref.collection('assets').doc(data.assetId), { ...result, state: 'copying', copiedBy: user.uid, sourceProjectId: data.sourceProjectId, sourceFingerprint })
    return { original: canonical, sourceFingerprint, result, ready: false }
  })
  if (asset.ready) return asset.result
  const [bytes] = await bucket().file(asset.original.path).download({ decompress: false })
  if (bytes.length !== asset.original.size) throw new HttpsError('failed-precondition', 'Floorplan contents do not match the saved image.')
  try { await bucket().file(asset.result.path).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } }) } catch (error) { if ((error as { code?: number }).code !== 412) throw error }
  return db.runTransaction(async (tx) => {
    const source = await tx.get(projectRef(data.sourceProjectId)); const target = await tx.get(projectRef(data.projectId))
    if (!source.exists || !target.exists) throw new HttpsError('not-found', 'Project unavailable.')
    await requireMember(tx, source.get('orgId'), user.uid); await requireMember(tx, target.get('orgId'), user.uid)
    requireActive(summarySchema.parse(source.data())); requireActive(summarySchema.parse(target.data()))
    const original = await tx.get(source.ref.collection('assets').doc(data.assetId))
    const existing = await tx.get(target.ref.collection('assets').doc(data.assetId))
    if (original.get('state') !== 'ready' || hash(JSON.stringify(assetSchema.parse(original.data()))) !== asset.sourceFingerprint) throw new HttpsError('permission-denied', 'Floorplan unavailable.')
    if (existing.get('state') === 'ready') return assetSchema.parse(existing.data())
    if (existing.get('state') !== 'copying' || existing.get('copiedBy') !== user.uid || existing.get('sourceProjectId') !== data.sourceProjectId || existing.get('sourceFingerprint') !== asset.sourceFingerprint) throw new HttpsError('failed-precondition', 'Floorplan copy is unavailable.')
    tx.set(target.ref.collection('assets').doc(data.assetId), { ...asset.result, state: 'ready' })
    return asset.result
  })
}

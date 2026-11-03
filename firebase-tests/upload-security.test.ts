import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { Timestamp } from 'firebase-admin/firestore'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'
import sharp from 'sharp'
import { bucket, db, projectRef } from '../functions/src/context'
import { prepareUpload, finalizeUpload, copyAsset } from '../functions/src/assets'
import { createProject, loadProject, saveProject } from '../functions/src/projects'
import { MAX_PENDING_UPLOADS, MAX_UPLOAD_BYTES, MAX_UPLOAD_PROCESSING_ATTEMPTS, ORG_UPLOAD_BYTES_PER_DAY, USER_UPLOAD_BYTES_PER_DAY, uploadBudgetRef } from '../functions/src/upload-budget'
import { createBrief } from '../src/features/briefs/model/brief'

let env: RulesTestEnvironment
const owner = { uid: 'upload-owner', name: 'Owner' }
const member = { uid: 'upload-member', name: 'Member' }
const outsider = { uid: 'upload-outsider', name: 'Outsider' }
const claims = { email: 'upload@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }
const storage = (uid = owner.uid, token = claims) => env.authenticatedContext(uid, token).storage('gs://demo-dronebrief.appspot.com')
const windowStart = () => Math.floor(Date.now() / 86400_000) * 86400_000
const request = (projectId: string) => ({ projectId, assetId: crypto.randomUUID(), fileId: crypto.randomUUID(), fileName: 'plan.png' })
const create = () => createProject(owner, { orgId: 'upload-org', brief: createBrief({ name: 'Upload security', clientName: 'Synthetic' }), assets: {}, operationId: crypto.randomUUID() })
const png = () => sharp({ create: { width: 12, height: 8, channels: 4, background: '#ff0000' } }).png().toBuffer()
const sourceAsset = async () => {
  const project = await create()
  const data = request(project.summary.id)
  const { path } = await prepareUpload(owner, data)
  await uploadBytes(ref(storage(), path), await png(), { contentType: 'image/png' })
  const asset = await finalizeUpload(owner, data)
  return { project, data, asset }
}
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dronebrief', firestore: { rules: readFileSync('firestore.rules', 'utf8') }, storage: { rules: readFileSync('storage.rules', 'utf8') } })
})
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await db.doc('organizations/upload-org').set({ name: 'Synthetic', adminCount: 1 })
  for (const user of [owner, member]) await db.doc(`organizations/upload-org/members/${user.uid}`).set({ orgId: 'upload-org', uid: user.uid, name: user.name, role: user === owner ? 'admin' : 'member', joinedAt: new Date().toISOString() })
})

describe('reserved Storage uploads', () => {
  it('denies unreserved uploads and binds reservations to a current verified organization member', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const path = `organizations/upload-org/projects/${data.projectId}/staging/${data.assetId}`
    const bytes = new Uint8Array([1, 2, 3])
    await assertFails(uploadBytes(ref(storage(), path), bytes, { contentType: 'image/png' }))
    await prepareUpload(owner, data)
    await assertFails(uploadBytes(ref(storage(member.uid), path), bytes, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(storage(outsider.uid), path), bytes, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(storage(owner.uid, { ...claims, email_verified: false }), path), bytes, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(storage(owner.uid, { ...claims, firebase: { sign_in_provider: 'password' } }), path), bytes, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(storage(), path.replace('/upload-org/', '/other-org/')), bytes, { contentType: 'image/png' }))
    await db.doc(`organizations/upload-org/members/${owner.uid}`).delete()
    await assertFails(uploadBytes(ref(storage(), path), bytes, { contentType: 'image/png' }))
  })

  it('enforces reservation expiry, size and MIME, and denies overwrite, read and delete', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const { path } = await prepareUpload(owner, data)
    const reference = ref(storage(), path)
    const bytes = new Uint8Array([1, 2, 3])
    await projectRef(data.projectId).update({ [`pendingUploads.${data.assetId}.expiresAt`]: Timestamp.fromMillis(0) })
    await assertFails(uploadBytes(reference, bytes, { contentType: 'image/png' }))
    await projectRef(data.projectId).update({ [`pendingUploads.${data.assetId}.expiresAt`]: Timestamp.fromMillis(Date.now() + 60_000), [`pendingUploads.${data.assetId}.maxBytes`]: 2 })
    await assertFails(uploadBytes(reference, bytes, { contentType: 'image/png' }))
    await projectRef(data.projectId).update({ [`pendingUploads.${data.assetId}.maxBytes`]: MAX_UPLOAD_BYTES })
    await assertFails(uploadBytes(reference, bytes, { contentType: 'text/plain' }))
    await assertSucceeds(uploadBytes(reference, bytes, { contentType: 'image/png' }))
    await assertFails(uploadBytes(reference, bytes, { contentType: 'image/png' }))
    await assertFails(getBytes(reference))
    await assertFails(deleteObject(reference))
  })

  it('denies encoded client uploads and rejects retained gzip originals before decoding', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const { path } = await prepareUpload(owner, data)
    const compressed = gzipSync(await png())
    await assertFails(uploadBytes(ref(storage(), path), compressed, { contentType: 'image/png', contentEncoding: 'gzip' }))
    // A retained object from the old rules is still rejected by the backend.
    await bucket().file(path).save(compressed, { resumable: false, metadata: { contentType: 'image/png', contentEncoding: 'gzip' } })
    await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'invalid-argument', message: 'Encoded uploads are not supported. Choose the original JPG or PNG file.' })
    expect((await projectRef(data.projectId).collection('assets').doc(data.assetId).get()).get('state')).toBe('failed')
    expect((await projectRef(data.projectId).get()).get(`pendingUploads.${data.assetId}`)).toBeUndefined()
    await expect(prepareUpload(owner, data)).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('keeps retries idempotent and rejects changed, expired and cross-user preparations', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const first = await prepareUpload(owner, data)
    const initial = (await projectRef(data.projectId).get()).get(`pendingUploads.${data.assetId}`)
    expect(await prepareUpload(owner, data)).toEqual(first)
    expect((await projectRef(data.projectId).get()).get(`pendingUploads.${data.assetId}`)).toEqual(initial)
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(MAX_UPLOAD_BYTES)
    await expect(prepareUpload(member, data)).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(prepareUpload(owner, { ...data, fileId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(prepareUpload(owner, { ...data, fileName: 'different.png' })).rejects.toMatchObject({ code: 'invalid-argument' })
    await projectRef(data.projectId).update({ [`pendingUploads.${data.assetId}.expiresAt`]: Timestamp.fromMillis(0) })
    await expect(prepareUpload(owner, data)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(MAX_UPLOAD_BYTES)
  })

  it('bounds the active project reservation map and discards expired entries on a new preparation', async () => {
    const project = await create()
    const pendingUploads = Object.fromEntries(Array.from({ length: MAX_PENDING_UPLOADS }, () => [crypto.randomUUID(), { uid: owner.uid, maxBytes: MAX_UPLOAD_BYTES, expiresAt: Timestamp.fromMillis(Date.now() + 60_000) }]))
    await projectRef(project.summary.id).update({ pendingUploads })
    await expect(prepareUpload(owner, request(project.summary.id))).rejects.toMatchObject({ code: 'resource-exhausted' })
    await projectRef(project.summary.id).update({ [`pendingUploads.${Object.keys(pendingUploads)[0]}.expiresAt`]: Timestamp.fromMillis(0) })
    await prepareUpload(owner, request(project.summary.id))
    expect(Object.keys((await projectRef(project.summary.id).get()).get('pendingUploads'))).toHaveLength(MAX_PENDING_UPLOADS)
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(MAX_UPLOAD_BYTES)
  })
})

describe('atomic upload budgets', () => {
  it('permits only one concurrent reservation when a user has one upload left', async () => {
    const project = await create()
    await uploadBudgetRef('user', owner.uid).set({ windowStart: windowStart(), bytes: USER_UPLOAD_BYTES_PER_DAY - MAX_UPLOAD_BYTES })
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => prepareUpload(owner, request(project.summary.id))))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of results) if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'resource-exhausted' })
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(USER_UPLOAD_BYTES_PER_DAY)
    expect((await uploadBudgetRef('org', 'upload-org').get()).get('bytes')).toBe(MAX_UPLOAD_BYTES)
  })

  it('enforces the shared organization budget across concurrent members', async () => {
    const project = await create()
    await uploadBudgetRef('org', 'upload-org').set({ windowStart: windowStart(), bytes: ORG_UPLOAD_BYTES_PER_DAY - MAX_UPLOAD_BYTES })
    const results = await Promise.allSettled([owner, member].map((user) => prepareUpload(user, request(project.summary.id))))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'resource-exhausted' } })
    expect((await uploadBudgetRef('org', 'upload-org').get()).get('bytes')).toBe(ORG_UPLOAD_BYTES_PER_DAY)
    expect(Object.keys((await projectRef(project.summary.id).get()).get('pendingUploads'))).toHaveLength(1)
  })

  it('rolls the UTC day over in fixed private counter documents', async () => {
    const project = await create()
    await uploadBudgetRef('user', owner.uid).set({ windowStart: windowStart() - 86400_000, bytes: USER_UPLOAD_BYTES_PER_DAY })
    await uploadBudgetRef('org', 'upload-org').set({ windowStart: windowStart() - 86400_000, bytes: ORG_UPLOAD_BYTES_PER_DAY })
    await prepareUpload(owner, request(project.summary.id))
    expect((await db.collection('uploadBudgets').get()).size).toBe(2)
    for (const reference of [uploadBudgetRef('user', owner.uid), uploadBudgetRef('org', 'upload-org')]) {
      const counter = await reference.get()
      expect(counter.get('windowStart')).toBe(windowStart())
      expect(counter.get('bytes')).toBe(MAX_UPLOAD_BYTES)
      expect(counter.get('expiresAt').toMillis()).toBeGreaterThan(Date.now())
    }
  })
})

describe('upload finalization and replay protection', () => {
  it('preserves the honest two-image save flow and revokes upload authority before originals are deleted', async () => {
    const project = await create()
    const image = await png()
    const records = []
    for (let i = 0; i < 2; i++) {
      const data = request(project.summary.id)
      const { path } = await prepareUpload(owner, data)
      await assertSucceeds(uploadBytes(ref(storage(), path), image, { contentType: 'image/png' }))
      const asset = await finalizeUpload(owner, data)
      expect(await finalizeUpload(owner, data)).toEqual(asset)
      expect((await projectRef(data.projectId).get()).get(`pendingUploads.${data.assetId}`)).toBeUndefined()
      expect((await bucket().file(path).exists())[0]).toBe(false)
      await assertFails(uploadBytes(ref(storage(), path), image, { contentType: 'image/png' }))
      await expect(prepareUpload(owner, data)).rejects.toMatchObject({ code: 'failed-precondition' })
      records.push({ data, asset })
    }
    const references = records.map(({ data }) => ({ id: data.fileId, caption: 'Synthetic image', source: { kind: 'local-file' as const, fileId: data.fileId, fileName: data.fileName } }))
    const assets = Object.fromEntries(records.map(({ data, asset }) => [data.fileId, asset]))
    await saveProject(owner, { projectId: project.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: { ...project.brief, references }, assets })
    expect((await loadProject(owner, { projectId: project.summary.id })).assets).toEqual(assets)
    for (const { asset } of records) await assertSucceeds(getBytes(ref(storage(), asset.path)))
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(2 * MAX_UPLOAD_BYTES)
  })

  it('finishes a pre-expiry original after reservation expiry but rejects an original created too late', async () => {
    const project = await create()
    const image = await png()
    for (const valid of [true, false]) {
      const data = request(project.summary.id)
      const { path } = await prepareUpload(owner, data)
      await uploadBytes(ref(storage(), path), image, { contentType: 'image/png' })
      const [metadata] = await bucket().file(path).getMetadata()
      const expiry = Timestamp.fromMillis(Date.parse(metadata.timeCreated!) + (valid ? 1 : -1))
      await projectRef(data.projectId).update({ [`pendingUploads.${data.assetId}.expiresAt`]: expiry })
      await projectRef(data.projectId).collection('assets').doc(data.assetId).update({ uploadExpiresAt: expiry })
      if (valid) expect((await finalizeUpload(owner, data)).id).toBe(data.assetId)
      else await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'invalid-argument' })
    }
  })

  it('ends invalid-image authority permanently without refunding its reserved bytes', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const { path } = await prepareUpload(owner, data)
    const original = new Uint8Array([1, 2, 3])
    await uploadBytes(ref(storage(), path), original, { contentType: 'image/png' })
    await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'invalid-argument' })
    const saved = await projectRef(data.projectId).collection('assets').doc(data.assetId).get()
    expect(saved.get('state')).toBe('failed')
    expect(saved.get('processingUntil')).toBeUndefined()
    expect((await projectRef(data.projectId).get()).get(`pendingUploads.${data.assetId}`)).toBeUndefined()
    await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(prepareUpload(owner, data)).rejects.toMatchObject({ code: 'failed-precondition' })
    await bucket().file(path).delete()
    await assertFails(uploadBytes(ref(storage(), path), original, { contentType: 'image/png' }))
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(MAX_UPLOAD_BYTES)
  })

  it('releases a missing-original lease so an honest upload and finalize retry can succeed', async () => {
    const project = await create()
    const data = request(project.summary.id)
    const { path } = await prepareUpload(owner, data)
    await expect(finalizeUpload(owner, data)).rejects.toBeDefined()
    expect((await projectRef(data.projectId).collection('assets').doc(data.assetId).get()).get('processingUntil')).toBeUndefined()
    expect(await prepareUpload(owner, data)).toEqual({ path })
    await uploadBytes(ref(storage(), path), await png(), { contentType: 'image/png' })
    expect((await finalizeUpload(owner, data)).id).toBe(data.assetId)
  })

  it('rejects concurrent processing leases and caps abandoned processing retries', async () => {
    const project = await create()
    const data = request(project.summary.id)
    await prepareUpload(owner, data)
    const asset = projectRef(data.projectId).collection('assets').doc(data.assetId)
    await asset.update({ processingUntil: new Date(Date.now() + 60_000).toISOString(), processingAttempts: 1 })
    await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'aborted' })
    await asset.update({ processingUntil: new Date(0).toISOString(), processingAttempts: MAX_UPLOAD_PROCESSING_ATTEMPTS })
    await expect(finalizeUpload(owner, data)).rejects.toMatchObject({ code: 'resource-exhausted' })
  })
})

describe('budgeted image copies', () => {
  it('charges one canonical image size across an interrupted copy, retry and ready replay', async () => {
    const { project: source, asset } = await sourceAsset()
    const target = await create()
    const data = { projectId: target.summary.id, sourceProjectId: source.summary.id, assetId: asset.id }
    const [bytes] = await bucket().file(asset.path).download({ decompress: false })
    await bucket().file(asset.path).delete()
    const before = (await uploadBudgetRef('user', owner.uid).get()).get('bytes')
    await expect(copyAsset(owner, data)).rejects.toBeDefined()
    const targetAsset = projectRef(target.summary.id).collection('assets').doc(asset.id)
    expect((await targetAsset.get()).data()).toMatchObject({ state: 'copying', copiedBy: owner.uid, sourceProjectId: source.summary.id })
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(before + asset.size)
    await expect(copyAsset(member, data)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await uploadBudgetRef('user', member.uid).get()).exists).toBe(false)

    const differentSource = await create()
    await projectRef(differentSource.summary.id).collection('assets').doc(asset.id).set({ ...asset, projectId: differentSource.summary.id, state: 'ready' })
    await expect(copyAsset(owner, { ...data, sourceProjectId: differentSource.summary.id })).rejects.toMatchObject({ code: 'failed-precondition' })
    await bucket().file(asset.path).save(bytes, { resumable: false, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } })
    const copied = await copyAsset(owner, data)
    expect(await copyAsset(owner, data)).toEqual(copied)
    expect(await copyAsset(member, data)).toEqual(copied)
    expect((await uploadBudgetRef('user', owner.uid).get()).get('bytes')).toBe(before + asset.size)
    expect((await targetAsset.get()).get('state')).toBe('ready')
    expect((await targetAsset.get()).get('copiedBy')).toBeUndefined()
    expect((await bucket().file(copied.path).download({ decompress: false }))[0]).toEqual(bytes)
  })

  it.each(['user', 'org'] as const)('denies a copy before Storage I/O when its %s budget is exhausted', async (kind) => {
    const { project: source, asset } = await sourceAsset()
    const target = await create()
    const counter = uploadBudgetRef(kind, kind === 'user' ? owner.uid : 'upload-org')
    const limit = kind === 'user' ? USER_UPLOAD_BYTES_PER_DAY : ORG_UPLOAD_BYTES_PER_DAY
    const previousBytes = limit - asset.size + 1
    await counter.set({ windowStart: windowStart(), bytes: previousBytes })
    await expect(copyAsset(owner, { projectId: target.summary.id, sourceProjectId: source.summary.id, assetId: asset.id })).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect((await counter.get()).get('bytes')).toBe(previousBytes)
    expect((await projectRef(target.summary.id).collection('assets').doc(asset.id).get()).exists).toBe(false)
    expect((await bucket().file(`organizations/upload-org/projects/${target.summary.id}/floorplans/${asset.id}.webp`).exists())[0]).toBe(false)
  })
})

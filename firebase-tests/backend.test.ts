import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { getDoc, doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getBytes } from 'firebase/storage'
import sharp from 'sharp'
import { db, bucket, emailKey, principal } from '../functions/src/context'
import { initializeAccount, manageOrganization, createOrganization } from '../functions/src/organizations'
import { createProject, loadProject, purgeProject, renameProject, saveProject, trashProject } from '../functions/src/projects'
import { prepareUpload, finalizeUpload, copyAsset } from '../functions/src/assets'
import { cleanup as cleanExpired } from '../functions/src/cleanup'
import { shareProject, loadPublicProject, publicAsset } from '../functions/src/sharing'
import { collections, listLibrary, updateProjection, processIndexJob } from '../functions/src/library'
import { createBrief } from '../src/features/briefs/model/brief'
import { namePrefixes, type Actor } from '../src/features/cloud/model/cloud'
import type { CallableRequest } from 'firebase-functions/v2/https'

let env: RulesTestEnvironment
const owner = { uid: 'owner', name: 'Owner', email: 'owner@plyo.com' }
const member = { uid: 'member', name: 'Member', email: 'member@plyo.com' }
const outsider = { uid: 'outsider', name: 'Outsider', email: 'outsider@plyo.com' }
const google = { email: owner.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-dronebrief', firestore: { rules: readFileSync('firestore.rules', 'utf8') }, storage: { rules: readFileSync('storage.rules', 'utf8') } }) })
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await db.doc('organizations/org').set({ name: 'Plyo', adminCount: 1 })
  for (const [user, role] of [[owner, 'admin'], [member, 'member']] as const) {
    const grant = { id: emailKey(user.email), email: user.email, role, status: 'active', uid: user.uid, updatedAt: new Date().toISOString() }
    await db.doc(`organizations/org/members/${user.uid}`).set({ orgId: 'org', uid: user.uid, name: user.name, role, joinedAt: new Date().toISOString(), grantId: grant.id })
    await db.doc(`organizations/org/grants/${grant.id}`).set(grant)
    await db.doc(`emailGrants/${grant.id}/organizations/org`).set(grant)
    await db.doc(`users/${user.uid}/organizations/org`).set({ id: 'org', name: 'Plyo', role, indexing: false })
  }
})
const brief = () => createBrief({ name: 'Project', clientName: 'Client' })
const create = (user: Actor = owner) => createProject(user, { orgId: 'org', brief: brief(), assets: {}, operationId: crypto.randomUUID() })

describe('authority and memberships', () => {
  it('requires a verified Google identity and rejects arbitrary authentication providers', () => {
    for (const claims of [{ ...google, email_verified: false }, { ...google, firebase: { sign_in_provider: 'password' } }]) expect(() => principal({ auth: { uid: owner.uid, token: claims } } as unknown as CallableRequest)).toThrow('verified Google')
    expect(principal({ auth: { uid: owner.uid, token: google } } as unknown as CallableRequest).email).toBe(owner.email)
  })
  it('activates only an exact pending email and never restores a revoked membership', async () => {
    await manageOrganization(owner, { orgId: 'org', action: 'add', email: outsider.email })
    expect(await initializeAccount({ ...outsider, email: 'different@plyo.com' })).toEqual([])
    const access = await initializeAccount(outsider)
    expect(access).toHaveLength(1)
    expect((await db.doc('organizations/org/members/outsider').get()).get('role')).toBe('member')
    await manageOrganization(owner, { orgId: 'org', action: 'remove', grantId: emailKey(outsider.email) })
    expect(await initializeAccount(outsider)).toEqual([])
    await expect(manageOrganization(member, { orgId: 'org', action: 'add', email: 'admin@x.com', role: 'admin' })).rejects.toMatchObject({ code: 'permission-denied' })
  })
  it('protects the final active administrator and allows only admins to create organizations', async () => {
    await expect(manageOrganization(owner, { orgId: 'org', action: 'role', grantId: emailKey(owner.email), role: 'member' })).rejects.toThrow('active administrator')
    await expect(createOrganization(member, { sourceOrgId: 'org', name: 'Bad', operationId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'permission-denied' })
    const result = await createOrganization(owner, { sourceOrgId: 'org', name: 'New', operationId: crypto.randomUUID() })
    expect((await db.doc(`organizations/${result.id}/members/owner`).get()).get('role')).toBe('admin')
  })
  it('handles concurrent administrator demotions transactionally', async () => {
    await manageOrganization(owner, { orgId: 'org', action: 'role', grantId: emailKey(member.email), role: 'admin' })
    const result = await Promise.allSettled([
      manageOrganization(owner, { orgId: 'org', action: 'role', grantId: emailKey(owner.email), role: 'member' }),
      manageOrganization(member, { orgId: 'org', action: 'role', grantId: emailKey(member.email), role: 'member' }),
    ])
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect((await db.doc('organizations/org').get()).get('adminCount')).toBe(1)
  })
})

describe('projects and persistence', () => {
  it('denies cross-organization loads and rejects silent concurrent overwrites', async () => {
    const project = await create()
    await expect(loadProject(outsider, { projectId: project.summary.id })).rejects.toMatchObject({ code: 'permission-denied' })
    const update = { projectId: project.summary.id, expectedRevision: 1, brief: project.brief, assets: {} }
    const results = await Promise.allSettled([saveProject(owner, { ...update, operationId: crypto.randomUUID() }), saveProject(member, { ...update, operationId: crypto.randomUUID() })])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'aborted' } })
    expect((await loadProject(owner, { projectId: project.summary.id })).summary.revision).toBe(2)
  })
  it('replays a lost acknowledgment, rejects changed idempotency payloads and respects revoked membership', async () => {
    const project = await create()
    const request = { projectId: project.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: project.brief, assets: {} }
    expect(await saveProject(member, request)).toEqual(await saveProject(member, request))
    await expect(saveProject(member, { ...request, expectedRevision: 2 })).rejects.toMatchObject({ code: 'invalid-argument' })
    await manageOrganization(owner, { orgId: 'org', action: 'remove', grantId: emailKey(member.email) })
    await expect(saveProject(member, request)).rejects.toMatchObject({ code: 'permission-denied' })
  })
  it('limits deletion to creator/admin and revokes public links across trash and restore', async () => {
    const project = await create()
    const { token } = await shareProject(owner, { projectId: project.summary.id, action: 'enable' })
    const publicView = await loadPublicProject(token!)
    expect(publicView.summary.createdBy).toEqual({ uid: 'public', name: owner.name })
    expect(JSON.stringify(publicView)).not.toContain(owner.email)
    await expect(trashProject(member, { projectId: project.summary.id })).rejects.toMatchObject({ code: 'permission-denied' })
    await trashProject(owner, { projectId: project.summary.id })
    await expect(loadPublicProject(token!)).rejects.toMatchObject({ code: 'not-found' })
    await trashProject(owner, { projectId: project.summary.id, restore: true })
    await expect(loadPublicProject(token!)).rejects.toMatchObject({ code: 'not-found' })
    expect((await loadProject(owner, { projectId: project.summary.id })).summary.deletedAt).toBeNull()
  })
  it('atomically persists multi-document bodies and deletes obsolete chunks on a smaller save', async () => {
    const large = brief()
    const image = { id: 'legacy', name: 'Legacy image', source: 'data:image/png;base64,' + 'AAAA'.repeat(280000), position: large.coordinates, widthMeters: 10, heightMeters: 10, rotationDegrees: 0, opacity: 1 }
    large.imageOverlays = [image]
    const project = await createProject(owner, { orgId: 'org', brief: large, assets: {}, operationId: crypto.randomUUID() })
    expect((await db.collection(`projects/${project.summary.id}/body`).get()).size).toBeGreaterThan(1)
    expect((await loadProject(member, { projectId: project.summary.id })).brief).toEqual(large)
    await saveProject(owner, { projectId: project.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: { ...large, imageOverlays: [] }, assets: {} })
    expect((await db.collection(`projects/${project.summary.id}/body`).get()).size).toBe(1)
    await expect(createProject(owner, { orgId: 'org', brief: { ...large, imageOverlays: [image, { ...image, id: 'second' }] }, assets: {}, operationId: crypto.randomUUID() })).rejects.toThrow('2 MB')
  })
  it('retains organization ownership after a creator leaves and enforces the recovery deadline', async () => {
    const project = await create(member)
    await manageOrganization(owner, { orgId: 'org', action: 'remove', grantId: emailKey(member.email) })
    expect((await loadProject(owner, { projectId: project.summary.id })).summary.createdBy.uid).toBe(member.uid)
    await trashProject(owner, { projectId: project.summary.id })
    await db.doc(`projects/${project.summary.id}`).update({ deletedAt: new Date(Date.now() - 31 * 86400_000).toISOString() })
    await expect(trashProject(owner, { projectId: project.summary.id, restore: true })).rejects.toThrow('recovery period')
    await cleanExpired()
    expect((await db.doc(`projects/${project.summary.id}`).get()).exists).toBe(false)
  })
  it('renames the stored brief and permanently deletes only a trashed project', async () => {
    const project = await create()
    await expect(renameProject(outsider, { projectId: project.summary.id, name: 'Stolen' })).rejects.toMatchObject({ code: 'permission-denied' })
    const renamed = await renameProject(member, { projectId: project.summary.id, name: 'Renamed project' })
    expect(renamed.name).toBe('Renamed project')
    expect(renamed.revision).toBe(2)
    expect((await loadProject(owner, { projectId: project.summary.id })).brief.project.name).toBe('Renamed project')
    await expect(purgeProject(owner, { projectId: project.summary.id })).rejects.toThrow('Deleted projects')
    await expect(purgeProject(member, { projectId: project.summary.id })).rejects.toMatchObject({ code: 'permission-denied' })
    await trashProject(owner, { projectId: project.summary.id })
    await expect(renameProject(owner, { projectId: project.summary.id, name: 'Still gone' })).rejects.toThrow('Deleted projects')
    await purgeProject(owner, { projectId: project.summary.id })
    expect((await db.doc(`projects/${project.summary.id}`).get()).exists).toBe(false)
    await expect(loadProject(owner, { projectId: project.summary.id })).rejects.toMatchObject({ code: 'not-found' })
  })
})

describe('rules and optimized assets', () => {
  it('denies direct metadata writes, anonymous reads, forged roles, and cross-org reads', async () => {
    const project = await create()
    const authenticated = env.authenticatedContext(owner.uid, google).firestore()
    const foreign = env.authenticatedContext(outsider.uid, { ...google, email: outsider.email }).firestore()
    await assertSucceeds(getDoc(doc(authenticated, 'projects', project.summary.id)))
    await assertFails(getDoc(doc(foreign, 'projects', project.summary.id)))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'projects', project.summary.id)))
    await assertFails(setDoc(doc(authenticated, 'projects', project.summary.id), { ...project.summary, revision: 999 }))
    await assertFails(setDoc(doc(foreign, 'organizations/org/members/outsider'), { role: 'admin' }))
  })
  it('optimizes, persists and publicly serves floorplans without granting anonymous Storage access', async () => {
    const project = await create(); const assetId = crypto.randomUUID(); const fileId = crypto.randomUUID()
    const upload = await prepareUpload(owner, { projectId: project.summary.id, assetId, fileId, fileName: 'plan.png' })
    const image = await sharp({ create: { width: 100, height: 50, channels: 4, background: '#ffffff00' } }).png().toBuffer()
    const storage = env.authenticatedContext(owner.uid, google).storage('gs://demo-dronebrief.appspot.com')
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage('gs://demo-dronebrief.appspot.com'), upload.path), image, { contentType: 'image/png' }))
    await assertSucceeds(uploadBytes(ref(storage, upload.path), image, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(storage, upload.path), image, { contentType: 'image/png' }))
    const asset = await finalizeUpload(owner, { projectId: project.summary.id, assetId })
    expect(await finalizeUpload(owner, { projectId: project.summary.id, assetId })).toEqual(asset)
    expect((await bucket().file(upload.path).exists())[0]).toBe(false)
    const geometry = { id: 'image', name: 'Plan', source: { kind: 'local-file' as const, fileId, fileName: 'plan.png' }, position: project.brief.coordinates, widthMeters: 100, heightMeters: 50, rotationDegrees: 45, opacity: 0.5 }
    await saveProject(owner, { projectId: project.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: { ...project.brief, imageOverlays: [geometry] }, assets: { [fileId]: asset } })
    await assertSucceeds(getBytes(ref(storage, asset.path)))
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage('gs://demo-dronebrief.appspot.com'), asset.path)))
    await assertFails(getBytes(ref(env.authenticatedContext(outsider.uid, { ...google, email: outsider.email }).storage('gs://demo-dronebrief.appspot.com'), asset.path)))
    await assertFails(uploadBytes(ref(storage, asset.path), image, { contentType: 'image/webp' }))
    const { token } = await shareProject(owner, { projectId: project.summary.id, action: 'enable' })
    expect((await loadPublicProject(token!)).brief.imageOverlays[0]).toEqual(geometry)
    expect((await sharp(await publicAsset(token!, assetId)).metadata()).format).toBe('webp')
    const other = await create()
    await expect(saveProject(owner, { projectId: other.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: { ...project.brief, imageOverlays: [geometry] }, assets: { [fileId]: asset } })).rejects.toThrow('Upload every local floorplan')
    const copied = await copyAsset(owner, { projectId: other.summary.id, sourceProjectId: project.summary.id, assetId })
    expect(await copyAsset(owner, { projectId: other.summary.id, sourceProjectId: project.summary.id, assetId })).toEqual(copied)
    await shareProject(owner, { projectId: project.summary.id, action: 'revoke' })
    await expect(publicAsset(token!, assetId)).rejects.toMatchObject({ code: 'not-found' })
  })
  it('rejects malformed uploads and cleans abandoned assets without removing a processing original', async () => {
    const project = await create(); const assetId = crypto.randomUUID()
    const upload = await prepareUpload(owner, { projectId: project.summary.id, assetId, fileId: crypto.randomUUID(), fileName: 'bad.png' })
    await bucket().file(upload.path).save(Buffer.from('not an image'), { metadata: { contentType: 'image/png' } })
    await expect(finalizeUpload(owner, { projectId: project.summary.id, assetId })).rejects.toMatchObject({ code: 'invalid-argument' })
    const asset = db.doc(`projects/${project.summary.id}/assets/${assetId}`)
    await asset.update({ createdAt: new Date(Date.now() - 2 * 86400_000).toISOString() })
    await cleanExpired()
    expect((await bucket().file(upload.path).exists())[0]).toBe(true)
    await asset.update({ processingUntil: new Date(0).toISOString() })
    await cleanExpired()
    expect((await asset.get()).exists).toBe(false)
    expect((await bucket().file(upload.path).exists())[0]).toBe(false)
  })
})

describe('library and personal collections', () => {
  it('stores the editor map frame and restores it when an older project is listed', async () => {
    const project = await create()
    expect(project.summary.map).toEqual({ lat: 59.9139, lng: 10.7522, zoom: 10 })
    const ref = db.doc(`projects/${project.summary.id}`)
    const stored = (await ref.get()).data()!
    delete stored.map
    await ref.set(stored)
    await updateProjection(owner.uid, project.summary.id)
    const page = await listLibrary(owner, { orgId: 'org', view: 'mine' })
    expect(page.projects[0].map).toEqual({ lat: 59.9139, lng: 10.7522, zoom: 10 })
    expect((await db.doc(`projects/${project.summary.id}`).get()).get('map')).toEqual({ lat: 59.9139, lng: 10.7522, zoom: 10 })
  })
  it('keeps collection assignments personal and refreshes projections from current source data', async () => {
    const project = await create(); const id = crypto.randomUUID()
    await collections(owner, { orgId: 'org', action: 'create', id, name: 'Private collection' })
    await collections(owner, { orgId: 'org', action: 'assign', id, projectId: project.summary.id })
    await updateProjection(member.uid, project.summary.id)
    const own = await listLibrary(owner, { orgId: 'org', search: 'private' })
    expect(own.projects[0].collectionName).toBe('Private collection')
    expect((await listLibrary(member, { orgId: 'org', search: 'private' })).projects).toEqual([])
    await expect(collections(member, { orgId: 'org', action: 'rename', id, name: 'Stolen' })).rejects.toMatchObject({ code: 'not-found' })
    await collections(owner, { orgId: 'org', action: 'delete', id })
    const jobs = await db.collection('indexJobs').get()
    for (const job of jobs.docs) await processIndexJob(job.id)
    expect((await listLibrary(owner, { orgId: 'org' })).projects[0].collectionName).toBe('')
  })
  it('searches and paginates across 10,000 summaries instead of the loaded page', async () => {
    const stamp = new Date().toISOString()
    for (let batchStart = 0; batchStart < 10000; batchStart += 200) {
      const batch = db.batch()
      for (let i = batchStart; i < batchStart + 200; i++) {
        const id = `large-${String(i).padStart(5, '0')}`; const name = `Project ${String(i).padStart(5, '0')}`
        const creator = i % 2 ? member : owner
        const item = { id, orgId: 'org', name, clientName: 'Client', createdBy: { uid: creator.uid, name: creator.name }, editedBy: { uid: owner.uid, name: owner.name }, createdAt: stamp, updatedAt: new Date(Date.parse(stamp) + i * 1000).toISOString(), revision: 1, deletedAt: null, collectionId: null, collectionName: '' }
        batch.set(db.doc(`projects/${id}`), item)
        batch.set(db.doc(`users/owner/library/${id}`), { ...item, collectionId: i % 2 ? 'selected' : null, collectionName: i % 2 ? 'Personal plans' : '', deleted: false, nameSort: name.toLowerCase(), creatorSort: creator.name.toLowerCase(), prefixes: namePrefixes([name, 'Client', creator.name, 'Owner', i % 2 ? 'Personal plans' : '']) })
      }
      await batch.commit()
    }
    const query = { orgId: 'org', search: 'Project 099', sort: 'name', direction: 'asc' }
    const first = await listLibrary(owner, query); expect(first.projects).toHaveLength(50); expect(first.projects[0].name).toBe('Project 09900')
    const second = await listLibrary(owner, { ...query, cursor: first.cursor }); expect(second.projects).toHaveLength(50); expect(second.projects[49].name).toBe('Project 09999'); expect(second.cursor).toBeNull()
    await expect(listLibrary(owner, { ...query, search: 'changed', cursor: first.cursor })).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(listLibrary(outsider, query)).rejects.toMatchObject({ code: 'permission-denied' })
    const filtered = await listLibrary(owner, { ...query, collectionId: 'selected', creatorId: member.uid, direction: 'desc' })
    expect(filtered.projects).toHaveLength(50); expect(filtered.projects[0].name).toBe('Project 09999'); expect(filtered.projects[49].name).toBe('Project 09901')
    expect((await listLibrary(owner, { orgId: 'org', search: 'PERSONAL', sort: 'updated', direction: 'desc' })).projects[0].id).toBe('large-09999')
    expect((await listLibrary(owner, { orgId: 'org', search: 'MEMBER', sort: 'creator', direction: 'asc' })).projects.every((project) => project.createdBy.uid === member.uid)).toBe(true)
    expect((await listLibrary(owner, { orgId: 'org', view: 'mine', sort: 'name', direction: 'desc' })).projects[0].id).toBe('large-09998')
  }, 180000)
})

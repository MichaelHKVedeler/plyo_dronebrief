import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { z } from 'zod'
import { db, now, principal } from './context.js'
import { initializeAccount, syncOrganization } from './organizations.js'
import { requireAccounts } from './accounts-sync.js'
import { roleSchema } from '../../src/features/cloud/model/cloud.js'
import { createProject, loadPreviews, loadProject, purgeProject, renameProject, savePreview, saveProject, trashProject } from './projects.js'
import { prepareUpload, finalizeUpload, copyAsset } from './assets.js'
import { collections, listLibrary, processIndexJob } from './library.js'
import { loadPublicProject, publicAsset, shareProject } from './sharing.js'
import { cleanup } from './cleanup.js'
import { enforceApiBudget, enforcePublicBudget, enforcePublicTransferBudget } from './request-budget.js'
import { requestNetworkKey } from './network-key.js'
import { projectNeedsIndex } from './project-index.js'

setGlobalOptions({ region: 'europe-west1', maxInstances: 20 })
const handle = async (request: CallableRequest) => {
  const user = principal(request)
  try {
    const { operation, data } = z.object({ operation: z.string().max(64), data: z.unknown() }).parse(request.data)
    await enforceApiBudget(user.uid, requestNetworkKey(request.rawRequest.headers), operation)
    switch (operation) {
      case 'account': return await initializeAccount(user)
      case 'createProject': return await createProject(user, data)
      case 'loadProject': return await loadProject(user, data)
      case 'saveProject': return await saveProject(user, data)
      case 'trashProject': return await trashProject(user, data)
      case 'purgeProject': return await purgeProject(user, data)
      case 'renameProject': return await renameProject(user, data)
      case 'savePreview': return await savePreview(user, data)
      case 'previews': return await loadPreviews(user, data)
      case 'prepareUpload': return await prepareUpload(user, data)
      case 'finalizeUpload': return await finalizeUpload(user, data)
      case 'copyAsset': return await copyAsset(user, data)
      case 'library': return await listLibrary(user, data)
      case 'collections': return await collections(user, data)
      case 'share': return await shareProject(user, data)
      default: throw new HttpsError('invalid-argument', 'Unknown operation.')
    }
  } catch (error) {
    if (error instanceof z.ZodError) throw new HttpsError('invalid-argument', 'Invalid request data.', error.flatten())
    throw error
  }
}
// Everything but image processing shares instances, so requests sent together do not each wait for a new one to start.
// shortcut: still 2GiB because tabs opened before the split send image processing here; lower it once those are gone.
export const api = onCall({ memory: '2GiB', timeoutSeconds: 300 }, handle)
// Decoding a large floorplan needs an instance to itself. The browser sends finalizeUpload here.
export const processing = onCall({ memory: '2GiB', timeoutSeconds: 300, concurrency: 1 }, handle)
export const publicView = onRequest({ cors: true, timeoutSeconds: 60, memory: '512MiB', concurrency: 8 }, async (request, response) => {
  response.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
  if (request.method !== 'POST') { response.status(405).end(); return }
  try {
    const { token, assetId } = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), assetId: z.uuid().optional() }).parse(request.body)
    const networkKey = requestNetworkKey(request.headers)
    await enforcePublicBudget(networkKey, token, false)
    if (!(await db.doc(`publicShares/${token}`).get()).exists) throw new HttpsError('not-found', 'This link is unavailable or has been revoked.')
    await enforcePublicBudget(networkKey, token, true)
    if (assetId) response.type('image/webp').send(await publicAsset(token, assetId))
    else {
      const body = JSON.stringify(await loadPublicProject(token))
      await enforcePublicTransferBudget(token, Buffer.byteLength(body))
      response.type('application/json').send(body)
    }
  } catch (error) {
    if (error instanceof HttpsError && ['resource-exhausted', 'unavailable'].includes(error.code)) {
      const retry = Number((error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds)
      response.set('Retry-After', String(Number.isFinite(retry) ? Math.max(1, Math.ceil(retry)) : 60))
      response.status(error.code === 'resource-exhausted' ? 429 : 503).json({ message: error.code === 'resource-exhausted'
        ? 'Too many requests. Please wait before trying again.'
        : 'Public links are temporarily unavailable. Please try again shortly.' })
      return
    }
    response.status(404).json({ message: 'This project or floorplan is unavailable, or its public link has been revoked.' })
  }
})
// Plyo Toolkits sends the members of the Plyo organization here whenever its own list changes (Manage Users there).
export const accountsSync = onRequest({ timeoutSeconds: 120, maxInstances: 1, concurrency: 1 }, async (request, response) => {
  response.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  if (request.method !== 'POST') { response.status(405).end(); return }
  try {
    await requireAccounts(request.get('Authorization'))
    // An empty list is refused: a mistake on the other side must never remove everyone.
    const { members } = z.object({ members: z.array(z.object({ email: z.email().max(254), role: roleSchema })).min(1).max(1000) }).parse(request.body)
    response.json(await syncOrganization(members))
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof HttpsError ? error.httpErrorCode.status : 500
    if (status === 500) console.error('Accounts sync failed', error)
    response.status(status).json({ message: status === 500 ? 'The member list could not be applied.' : 'Refused.' })
  }
})
export const projectIndex = onDocumentWritten({ document: 'projects/{projectId}', retry: true }, async (event) => {
  const project = event.data?.after.exists ? event.data.after : event.data?.before
  if (!project?.exists) return
  if (!projectNeedsIndex(event.data?.before.data(), event.data?.after.data())) return
  await db.doc(`indexJobs/${event.id}`).set({ kind: 'project', projectId: event.params.projectId, orgId: project.get('orgId'), after: null, createdAt: now() })
})
export const libraryIndex = onDocumentCreated({ document: 'indexJobs/{jobId}', retry: true, timeoutSeconds: 300 }, (event) => processIndexJob(event.params.jobId))
export const janitor = onSchedule({ schedule: 'every 24 hours', timeZone: 'Europe/Oslo', timeoutSeconds: 540 }, cleanup)

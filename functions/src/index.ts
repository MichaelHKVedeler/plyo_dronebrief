import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { z } from 'zod'
import { db, now, principal } from './context.js'
import { createOrganization, initializeAccount, manageOrganization } from './organizations.js'
import { createProject, loadProject, saveProject, trashProject } from './projects.js'
import { prepareUpload, finalizeUpload, copyAsset } from './assets.js'
import { collections, listLibrary, processIndexJob } from './library.js'
import { loadPublicProject, publicAsset, shareProject } from './sharing.js'
import { cleanup } from './cleanup.js'

setGlobalOptions({ region: 'europe-west1', maxInstances: 20 })
export const api = onCall({ memory: '2GiB', timeoutSeconds: 300, concurrency: 1 }, async (request) => {
  const user = principal(request)
  try {
    const { operation, data } = z.object({ operation: z.string(), data: z.unknown() }).parse(request.data)
    switch (operation) {
      case 'account': return await initializeAccount(user)
      case 'createOrganization': return await createOrganization(user, data)
      case 'organization': return await manageOrganization(user, data)
      case 'createProject': return await createProject(user, data)
      case 'loadProject': return await loadProject(user, data)
      case 'saveProject': return await saveProject(user, data)
      case 'trashProject': return await trashProject(user, data)
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
})
export const publicView = onRequest({ cors: true, timeoutSeconds: 60, memory: '512MiB', concurrency: 8 }, async (request, response) => {
  response.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
  if (request.method !== 'POST') { response.status(405).end(); return }
  try {
    const { token, assetId } = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), assetId: z.uuid().optional() }).parse(request.body)
    if (assetId) response.type('image/webp').send(await publicAsset(token, assetId))
    else response.json(await loadPublicProject(token))
  } catch { response.status(404).json({ message: 'This project or floorplan is unavailable, or its public link has been revoked.' }) }
})
export const projectIndex = onDocumentWritten({ document: 'projects/{projectId}', retry: true }, async (event) => {
  const project = event.data?.after.exists ? event.data.after : event.data?.before
  if (!project?.exists) return
  await db.doc(`indexJobs/${event.id}`).set({ kind: 'project', projectId: event.params.projectId, orgId: project.get('orgId'), after: null, createdAt: now() })
})
export const libraryIndex = onDocumentCreated({ document: 'indexJobs/{jobId}', retry: true, timeoutSeconds: 300 }, (event) => processIndexJob(event.params.jobId))
export const janitor = onSchedule({ schedule: 'every 24 hours', timeZone: 'Europe/Oslo', timeoutSeconds: 540 }, cleanup)

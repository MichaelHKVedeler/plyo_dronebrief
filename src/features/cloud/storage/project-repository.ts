import { projectSchema, summarySchema, type AssetManifest, type CloudProject } from '../model/cloud'
import type { DroneBrief } from '@/features/briefs/model/brief'
import { callCloud, publicEndpoint } from '../auth/firebase'
import { writeCloud } from './read-request'

export const cloudProjects = {
  async create(orgId: string, brief: DroneBrief, operationId: string) { return projectSchema.parse(await writeCloud('createProject', { orgId, brief, assets: {}, operationId })) },
  async load(projectId: string) { return projectSchema.parse(await callCloud('loadProject', { projectId })) },
  async save(projectId: string, expectedRevision: number, operationId: string, brief: DroneBrief, assets: AssetManifest) { return summarySchema.parse(await writeCloud('saveProject', { projectId, expectedRevision, operationId, brief, assets })) },
  async trash(projectId: string, restore = false) { await writeCloud('trashProject', { projectId, restore }) },
  async purge(projectId: string) { await writeCloud('purgeProject', { projectId }) },
  async rename(projectId: string, name: string) { return summarySchema.parse(await writeCloud('renameProject', { projectId, name })) },
  watch(projectId: string, onRevision: (revision: number) => void, onError: (error: Error) => void) {
    // Firestore is fetched when a project opens: signing in and the library never need it.
    let stop = () => {}; let stopped = false
    void import('./project-watch').then(({ watchProject }) => { if (!stopped) stop = watchProject(projectId, onRevision, onError) }, onError)
    return () => { stopped = true; stop() }
  },
}
/** The link itself is gone or revoked, as opposed to a request that merely failed. */
export class PublicLinkGone extends Error {}
export async function publicRequest(token: string, assetId?: string, signal?: AbortSignal) {
  const response = await fetch(publicEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, assetId }), cache: 'no-store', referrerPolicy: 'no-referrer', signal })
  if (response.status === 429) throw new Error('Too many requests. Please wait before trying again.')
  if (response.status === 503) throw new Error('Public links are temporarily unavailable. Please try again shortly.')
  if (!response.ok) throw new PublicLinkGone('This project or floorplan is unavailable, or its public link has been revoked.')
  return response
}
export async function loadPublic(token: string, signal?: AbortSignal): Promise<CloudProject> { return projectSchema.parse(await (await publicRequest(token, undefined, signal)).json()) }

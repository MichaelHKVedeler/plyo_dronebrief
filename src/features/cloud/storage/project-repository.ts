import { doc, onSnapshot } from 'firebase/firestore'
import { projectSchema, summarySchema, type AssetManifest, type CloudProject } from '../model/cloud'
import type { DroneBrief } from '@/features/briefs/model/brief'
import { callCloud, firebase, publicEndpoint } from '../auth/firebase'
import { writeCloud } from './read-request'

export const cloudProjects = {
  async create(orgId: string, brief: DroneBrief, operationId: string) { return projectSchema.parse(await writeCloud('createProject', { orgId, brief, assets: {}, operationId })) },
  async load(projectId: string) { return projectSchema.parse(await callCloud('loadProject', { projectId })) },
  async save(projectId: string, expectedRevision: number, operationId: string, brief: DroneBrief, assets: AssetManifest) { return summarySchema.parse(await writeCloud('saveProject', { projectId, expectedRevision, operationId, brief, assets })) },
  async trash(projectId: string, restore = false) { await writeCloud('trashProject', { projectId, restore }) },
  async purge(projectId: string) { await writeCloud('purgeProject', { projectId }) },
  async rename(projectId: string, name: string) { return summarySchema.parse(await writeCloud('renameProject', { projectId, name })) },
  watch(projectId: string, onRevision: (revision: number) => void, onError: (error: Error) => void) {
    return onSnapshot(doc(firebase().db, 'projects', projectId), (snapshot) => { if (snapshot.exists()) onRevision(snapshot.get('revision') as number); else onError(new Error('Project unavailable.')) }, onError)
  },
}
export async function publicRequest(token: string, assetId?: string, signal?: AbortSignal) {
  const response = await fetch(publicEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, assetId }), cache: 'no-store', referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new Error('This project or floorplan is unavailable, or its public link has been revoked.')
  return response
}
export async function loadPublic(token: string, signal?: AbortSignal): Promise<CloudProject> { return projectSchema.parse(await (await publicRequest(token, undefined, signal)).json()) }

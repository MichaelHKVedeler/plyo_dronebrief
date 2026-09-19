import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { HttpsError } from 'firebase-functions/v2/https'
import { cloudId, summarySchema, type Actor, type CloudProject } from '../../src/features/cloud/model/cloud.js'
import { bucket, db, projectRef, requireMember, canManage, requireActive, denied, now } from './context.js'
import { readBody } from './body.js'

export async function shareProject(user: Actor, input: unknown) {
  const data = z.object({ projectId: cloudId, action: z.enum(['enable', 'revoke', 'status']) }).parse(input)
  return db.runTransaction(async (tx) => {
    const ref = projectRef(data.projectId)
    const project = await tx.get(ref)
    if (!project.exists) throw new HttpsError('not-found', 'Project unavailable.')
    const summary = summarySchema.parse(project.data())
    const member = await requireMember(tx, summary.orgId, user.uid)
    requireActive(summary)
    if (!canManage(summary, member)) denied()
    const privateRef = db.doc(`projectPrivate/${data.projectId}`)
    const privateDoc = await tx.get(privateRef)
    const token = privateDoc.get('shareToken') as string | undefined
    if (data.action === 'status') return { token: token ?? null }
    if (data.action === 'revoke') {
      if (token) tx.delete(db.doc(`publicShares/${token}`))
      tx.set(privateRef, { shareToken: null })
      return { token: null }
    }
    if (token) return { token }
    const next = randomBytes(32).toString('base64url')
    tx.create(db.doc(`publicShares/${next}`), { projectId: data.projectId, createdAt: now(), createdBy: user.uid })
    tx.set(privateRef, { shareToken: next })
    return { token: next }
  })
}
export async function loadPublicProject(token: string): Promise<CloudProject> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpsError('not-found', 'This link is unavailable or has been revoked.')
  return db.runTransaction(async (tx) => {
    const link = await tx.get(db.doc(`publicShares/${token}`))
    if (!link.exists) throw new HttpsError('not-found', 'This link is unavailable or has been revoked.')
    const ref = projectRef(link.get('projectId'))
    const project = await tx.get(ref)
    if (!project.exists || project.get('deletedAt')) throw new HttpsError('not-found', 'This link is unavailable or has been revoked.')
    const summary = summarySchema.parse(project.data())
    const body = await readBody(tx, ref, project.get('chunkCount'))
    // Only a brief, asset descriptors, display names and timestamps; never membership/private settings.
    return { envelopeVersion: 1, summary: { ...summary, collectionId: null, collectionName: '', createdBy: { uid: 'public', name: summary.createdBy.name }, editedBy: { uid: 'public', name: summary.editedBy.name } }, ...body }
  })
}
export async function publicAsset(token: string, assetId: string) {
  const project = await loadPublicProject(token)
  const asset = Object.values(project.assets).find((candidate) => candidate.id === assetId)
  if (!asset) throw new HttpsError('not-found', 'Floorplan unavailable.')
  const [bytes] = await bucket().file(asset.path).download()
  // Revalidate after the download in case the link was revoked while reading Storage.
  const current = await loadPublicProject(token)
  if (!Object.values(current.assets).some((candidate) => candidate.id === assetId)) throw new HttpsError('not-found', 'Floorplan unavailable.')
  return bytes
}

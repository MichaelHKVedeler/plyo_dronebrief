import { type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { bucket, db, now, projectRef } from './context.js'

export async function cleanup() {
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString()
  const expired = await db.collection('projects').where('deletedAt', '<=', cutoff).limit(100).get()
  for (const project of expired.docs) {
    const purge = await db.runTransaction(async (tx) => {
      const current = await tx.get(project.ref)
      if (!current.get('deletedAt') || current.get('deletedAt') > cutoff) return false
      tx.update(project.ref, { purging: true }); return true
    })
    if (!purge) continue
    await bucket().deleteFiles({ prefix: `organizations/${project.get('orgId')}/projects/${project.id}/` })
    await db.recursiveDelete(project.ref)
    await db.doc(`projectPrivate/${project.id}`).delete()
    const entries = await db.collectionGroup('library').where('id', '==', project.id).get()
    for (let i = 0; i < entries.size; i += 400) {
      const batch = db.batch(); entries.docs.slice(i, i + 400).forEach((entry) => batch.delete(entry.ref)); await batch.commit()
    }
  }
  let cursor: QueryDocumentSnapshot | undefined
  const orphanCutoff = new Date(Date.now() - 86400_000).toISOString()
  for (;;) {
    let query = db.collectionGroup('assets').where('createdAt', '<', orphanCutoff).orderBy('createdAt').limit(100)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    for (const asset of page.docs) {
      const remove = await db.runTransaction(async (tx) => {
        const current = await tx.get(asset.ref)
        const project = await tx.get(projectRef(asset.get('projectId')))
        if (current.get('processingUntil') > now()) return null
        if (!current.exists || (project.get('assetIds') as string[] | undefined)?.includes(asset.id)) return false
        tx.update(asset.ref, { state: 'deleting' }); return true
      })
      if (remove === null) continue
      const prefix = `organizations/${asset.get('orgId')}/projects/${asset.get('projectId')}`
      await bucket().file(`${prefix}/staging/${asset.id}`).delete({ ignoreNotFound: true })
      if (remove) {
        await bucket().file(`${prefix}/floorplans/${asset.id}.webp`).delete({ ignoreNotFound: true })
        await asset.ref.delete()
      }
    }
    if (page.size < 100) break
    cursor = page.docs.at(-1)
  }
  // Rules allow member staging uploads before finalization. Also sweep files without
  // asset records, including uploads interrupted before their preparation response.
  let pageToken: string | undefined
  do {
    const [files, next] = await bucket().getFiles({ prefix: 'organizations/', autoPaginate: false, maxResults: 1000, pageToken })
    for (const file of files) {
      const match = /^organizations\/([^/]+)\/projects\/([^/]+)\/staging\/([^/]+)$/.exec(file.name)
      if (!match || !file.metadata.timeCreated || file.metadata.timeCreated >= orphanCutoff) continue
      const asset = await projectRef(match[2]).collection('assets').doc(match[3]).get()
      if (asset.get('processingUntil') > now()) continue
      await file.delete({ ignoreNotFound: true })
    }
    pageToken = next?.pageToken
  } while (pageToken)
  await db.doc('maintenance/cleanup').set({ completedAt: now() })
}

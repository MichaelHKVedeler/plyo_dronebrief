import { db, emailKey, now } from './context.js'

// Operator-only entrypoint: never exported as an HTTP/callable function.
if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT explicitly. Use operator credentials or the documented emulator environment.')
await db.runTransaction(async (tx) => {
  const marker = db.doc('setup/plyo-bootstrap-v1')
  if ((await tx.get(marker)).exists) return
  const org = db.doc('organizations/plyo')
  if ((await tx.get(org)).exists) throw new Error('Plyo already exists without the bootstrap marker; review it manually.')
  tx.create(org, { name: 'Plyo', createdAt: now(), createdBy: 'operator', adminCount: 0 })
  for (const email of ['kristian.nordahl@plyo.com', 'michael.vedeler@plyo.com']) {
    const id = emailKey(email)
    const grant = { id, email, role: 'admin', status: 'pending', uid: null, updatedAt: now(), addedBy: 'operator' }
    tx.create(org.collection('grants').doc(id), grant)
    tx.create(db.doc(`emailGrants/${id}/organizations/plyo`), grant)
  }
  tx.create(marker, { completedAt: now() })
})
console.log('Plyo bootstrap verified. Existing grants were not reset.')

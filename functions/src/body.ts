import { HttpsError } from 'firebase-functions/v2/https'
import type { DocumentReference, Transaction } from 'firebase-admin/firestore'
import { z } from 'zod'
import { briefSchema } from '../../src/features/briefs/model/brief.js'
import { assetsSchema } from '../../src/features/cloud/model/cloud.js'

export const bodySchema = z.object({ brief: briefSchema, assets: assetsSchema })
export type ProjectBody = z.infer<typeof bodySchema>
const CHUNK_BYTES = 512 * 1024
export function encodeBody(body: ProjectBody) {
  if (Buffer.byteLength(JSON.stringify(body.brief)) > 2_000_000) throw new HttpsError('invalid-argument', 'This brief exceeds the 2 MB limit.')
  const bytes = Buffer.from(JSON.stringify(bodySchema.parse(body)))
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_BYTES) chunks.push(bytes.subarray(i, i + CHUNK_BYTES).toString('base64'))
  return chunks
}
export function decodeBody(chunks: string[]) { return bodySchema.parse(JSON.parse(Buffer.concat(chunks.map((part) => Buffer.from(part, 'base64'))).toString('utf8'))) }
export async function readBody(tx: Transaction, ref: DocumentReference, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new HttpsError('data-loss', 'Invalid project body.')
  const docs = await tx.getAll(...Array.from({ length: count }, (_, i) => ref.collection('body').doc(String(i))))
  return decodeBody(docs.map((doc) => { if (!doc.exists) throw new HttpsError('data-loss', 'Incomplete project body.'); return doc.get('data') as string }))
}
export function writeBody(tx: Transaction, ref: DocumentReference, body: ProjectBody, previousCount = 0) {
  const chunks = encodeBody(body)
  chunks.forEach((data, i) => tx.set(ref.collection('body').doc(String(i)), { data }))
  for (let i = chunks.length; i < previousCount; i++) tx.delete(ref.collection('body').doc(String(i)))
  return chunks.length
}

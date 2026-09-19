import { z } from 'zod'
import { briefSchema, type DroneBrief } from '@/features/briefs/model/brief'
import { assetsSchema, cloudId } from '../model/cloud'

const recoverySchema = z.object({ operationId: z.uuid(), saveOperationId: z.uuid(), projectId: cloudId.nullable(), baseRevision: z.number().int().positive(), assets: assetsSchema, payload: briefSchema.nullable(), complete: z.boolean() })
export type MigrationRecovery = z.infer<typeof recoverySchema>
export async function loadMigration(uid: string, orgId: string, brief: DroneBrief) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(brief)))
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const key = `dronebrief:migration:v1:${uid}:${orgId}:${fingerprint}`
  const saved = localStorage.getItem(key)
  const recovery = saved ? recoverySchema.parse(JSON.parse(saved)) : { operationId: crypto.randomUUID(), saveOperationId: crypto.randomUUID(), projectId: null, baseRevision: 1, assets: {}, payload: null, complete: false }
  saveMigration(key, recovery)
  return { key, recovery }
}
export function saveMigration(key: string, recovery: MigrationRecovery) {
  try { localStorage.setItem(key, JSON.stringify(recoverySchema.parse(recovery))) }
  catch { throw new Error('The import recovery record could not be saved on this device. Free browser storage and retry; your original draft is unchanged.') }
}

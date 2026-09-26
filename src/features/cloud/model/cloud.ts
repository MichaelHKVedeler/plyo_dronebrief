import { z } from 'zod'
import { briefSchema } from '../../briefs/model/brief.js'
import { mapViewSchema } from './map-view.js'

export const cloudId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
export const cloudName = z.string().trim().min(1).max(200)
export const roleSchema = z.enum(['admin', 'member'])
export const actorSchema = z.object({ uid: cloudId, name: cloudName })
export const membershipSchema = z.object({ orgId: cloudId, uid: cloudId, name: cloudName, role: roleSchema, joinedAt: z.iso.datetime() })
export const organizationSchema = z.object({ id: cloudId, name: cloudName, role: roleSchema, indexing: z.boolean().default(false) })
export const grantSchema = z.object({ id: cloudId, email: z.email(), role: roleSchema, status: z.enum(['pending', 'active', 'revoked']), uid: cloudId.nullable(), updatedAt: z.iso.datetime() })
export const collectionSchema = z.object({ id: cloudId, orgId: cloudId, name: cloudName })
export const assetSchema = z.object({
  id: z.uuid(), fileId: z.uuid(), projectId: cloudId, orgId: cloudId,
  fileName: z.string().min(1).max(255), path: z.string().max(500),
  contentType: z.literal('image/webp'), width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096),
  size: z.number().int().positive().max(4 * 1024 * 1024), originalSize: z.number().int().positive(),
  originalWidth: z.number().int().positive(), originalHeight: z.number().int().positive(),
  optimizerVersion: z.literal(1), createdAt: z.iso.datetime(),
})
export const assetsSchema = z.record(z.uuid(), assetSchema).refine((assets) => Object.keys(assets).length <= 10, 'Maximum ten floorplans.')
export const summarySchema = z.object({
  id: cloudId, orgId: cloudId, name: cloudName, clientName: cloudName,
  createdBy: actorSchema, editedBy: actorSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  revision: z.number().int().nonnegative(), deletedAt: z.iso.datetime().nullable(),
  collectionId: cloudId.nullable().default(null), collectionName: z.string().max(200).default(''),
  map: mapViewSchema.optional(),
})
export const projectSchema = z.object({ envelopeVersion: z.literal(1), summary: summarySchema, brief: briefSchema, assets: assetsSchema })
export const libraryQuerySchema = z.object({
  orgId: cloudId, view: z.enum(['mine', 'organization', 'trash']).default('organization'),
  search: z.string().trim().max(200).default(''), collectionId: cloudId.nullable().default(null), creatorId: cloudId.nullable().default(null),
  sort: z.enum(['name', 'creator', 'updated']).default('updated'), direction: z.enum(['asc', 'desc']).default('desc'), cursor: z.string().max(4000).nullable().default(null),
})
export type Actor = z.infer<typeof actorSchema>
export type Organization = z.infer<typeof organizationSchema>
export type Membership = z.infer<typeof membershipSchema>
export type Grant = z.infer<typeof grantSchema>
export type PersonalCollection = z.infer<typeof collectionSchema>
export type CloudAsset = z.infer<typeof assetSchema>
export type AssetManifest = z.infer<typeof assetsSchema>
export type ProjectSummary = z.infer<typeof summarySchema>
export type CloudProject = z.infer<typeof projectSchema>
export type LibraryQuery = z.infer<typeof libraryQuerySchema>
export type LibraryPage = { projects: ProjectSummary[]; cursor: string | null; indexing: boolean }

export function normalizeName(value: string) { return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ') }
export function namePrefixes(values: string[]) {
  return [...new Set(values.flatMap((value) => {
    const normalized = normalizeName(value).slice(0, 200)
    return Array.from({ length: normalized.length }, (_, index) => normalized.slice(0, index + 1))
  }))]
}

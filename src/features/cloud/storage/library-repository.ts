import { z } from 'zod'
import { callCloud } from '../auth/firebase'
import { actorSchema, collectionSchema, summarySchema, type LibraryQuery } from '../model/cloud'

export const cloudLibrary = {
  async search(query: LibraryQuery) { return z.object({ projects: z.array(summarySchema), cursor: z.string().nullable(), indexing: z.boolean() }).parse(await callCloud('library', query)) },
  async collections(orgId: string) { return z.object({ collections: z.array(collectionSchema), creators: z.array(actorSchema) }).parse(await callCloud('collections', { orgId, action: 'list' })) },
  createCollection(orgId: string, name: string, id: string) { return callCloud('collections', { orgId, action: 'create', name, id }) },
  renameCollection(orgId: string, id: string, name: string) { return callCloud('collections', { orgId, action: 'rename', id, name }) },
  deleteCollection(orgId: string, id: string) { return callCloud('collections', { orgId, action: 'delete', id }) },
  assign(orgId: string, projectId: string, id: string | null) { return callCloud('collections', { orgId, action: 'assign', projectId, id: id ?? undefined }) },
}

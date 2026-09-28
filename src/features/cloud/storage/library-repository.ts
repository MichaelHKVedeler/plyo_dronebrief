import { z } from 'zod'
import { actorSchema, collectionSchema, summarySchema, type LibraryQuery } from '../model/cloud'
import { readCloud, writeCloud } from './read-request'

export const cloudLibrary = {
  async search(query: LibraryQuery) { return z.object({ projects: z.array(summarySchema), cursor: z.string().nullable(), indexing: z.boolean() }).parse(await readCloud('library', query)) },
  async collections(orgId: string) { return z.object({ collections: z.array(collectionSchema), creators: z.array(actorSchema) }).parse(await readCloud('collections', { orgId, action: 'list' })) },
  createCollection(orgId: string, name: string, id: string) { return writeCloud('collections', { orgId, action: 'create', name, id }) },
  renameCollection(orgId: string, id: string, name: string) { return writeCloud('collections', { orgId, action: 'rename', id, name }) },
  deleteCollection(orgId: string, id: string) { return writeCloud('collections', { orgId, action: 'delete', id }) },
  assign(orgId: string, projectId: string, id: string | null) { return writeCloud('collections', { orgId, action: 'assign', projectId, id: id ?? undefined }) },
}

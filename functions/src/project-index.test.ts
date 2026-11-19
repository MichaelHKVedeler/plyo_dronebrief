// @vitest-environment node
import { expect, it } from 'vitest'
import { projectNeedsIndex } from './project-index'

it('does not fan out library updates for upload reservation changes alone', () => {
  const project = { orgId: 'org', revision: 4, assetIds: ['a'], deletedAt: null }
  const uploading = { ...project, pendingUploads: { asset: { uid: 'user', maxBytes: 30 } } }
  expect(projectNeedsIndex(project, uploading)).toBe(false)
  expect(projectNeedsIndex(uploading, project)).toBe(false)
  expect(projectNeedsIndex(uploading, { ...uploading, pendingUploads: {} })).toBe(false)
  expect(projectNeedsIndex(project, { ...project, previewRevision: 4 }), 'A new card picture is not a library change').toBe(false)
})
it('still indexes creation, deletion, and mixed project changes', () => {
  const project = { orgId: 'org', revision: 4, assetIds: [], pendingUploads: {} }
  expect(projectNeedsIndex(undefined, project)).toBe(true)
  expect(projectNeedsIndex(project, undefined)).toBe(true)
  expect(projectNeedsIndex(project, { ...project, revision: 5, pendingUploads: { a: {} } })).toBe(true)
  expect(projectNeedsIndex(project, { ...project, assetIds: ['a'] })).toBe(true)
  expect(projectNeedsIndex(project, { ...project, deletedAt: 'now' })).toBe(true)
})

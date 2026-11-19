import { isDeepStrictEqual } from 'node:util'

export function projectNeedsIndex(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  if (!before || !after) return true
  // Upload reservations and the card picture's revision change nothing the library searches or sorts by.
  const { pendingUploads: _oldUploads, previewRevision: _oldPreview, ...oldProject } = before
  const { pendingUploads: _newUploads, previewRevision: _newPreview, ...newProject } = after
  return !isDeepStrictEqual(oldProject, newProject)
}

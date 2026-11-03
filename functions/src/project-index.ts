import { isDeepStrictEqual } from 'node:util'

export function projectNeedsIndex(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  if (!before || !after) return true
  const { pendingUploads: _oldUploads, ...oldProject } = before
  const { pendingUploads: _newUploads, ...newProject } = after
  return !isDeepStrictEqual(oldProject, newProject)
}

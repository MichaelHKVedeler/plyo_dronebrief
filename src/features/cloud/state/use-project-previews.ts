import { useEffect, useState } from 'react'
import type { ProjectSummary } from '../model/cloud'
import { cloudProjects } from '../storage/project-repository'

// One stored picture per project and version of that picture, kept while the app is open.
const pictures = new Map<string, string>()
const key = (project: ProjectSummary) => `${project.id}:${project.previewRevision}`

/** The stored map pictures of these projects. Those not seen before are fetched in one request. */
export function useProjectPreviews(orgId: string, projects: ProjectSummary[]) {
  const [, setFetched] = useState(0)
  useEffect(() => {
    const missing = projects.filter((project) => project.previewRevision && !pictures.has(key(project)))
    if (!missing.length) return
    let active = true
    void cloudProjects.previews(orgId, missing.map((project) => project.id)).then((found) => {
      for (const project of missing) if (found[project.id]) pictures.set(key(project), found[project.id])
      if (active) setFetched((count) => count + 1)
    // A card without its picture shows the placeholder.
    }).catch(() => undefined)
    return () => { active = false }
  }, [orgId, projects])
  return (project: ProjectSummary) => pictures.get(key(project))
}

import { briefSchema, type DroneBrief } from '../model/brief'

const PREFIX = 'dronebrief:draft:v1:'
const LAST_DRAFT = 'dronebrief:last-draft:v1'
export interface BriefRepository {
  save(brief: DroneBrief): void
  get(id: string): DroneBrief | null
  latest(): DroneBrief | null
  list(): DroneBrief[]
}

// Storage is accessed lazily so SSR, tests and disabled storage can be handled by callers.
export const briefRepository: BriefRepository = {
  list() {
    const drafts: DroneBrief[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      try { const data = localStorage.getItem(key); if (data) drafts.push(briefSchema.parse(JSON.parse(data))) } catch { /* A corrupt draft must not hide other valid drafts. */ }
    }
    return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  save(brief) {
    const validated = briefSchema.parse(brief)
    localStorage.setItem(PREFIX + validated.id, JSON.stringify(validated))
    localStorage.setItem(LAST_DRAFT, validated.id)
  },
  get(id) {
    const json = localStorage.getItem(PREFIX + id)
    return json ? briefSchema.parse(JSON.parse(json)) : null
  },
  latest() {
    const id = localStorage.getItem(LAST_DRAFT)
    return id ? this.get(id) : null
  },
}

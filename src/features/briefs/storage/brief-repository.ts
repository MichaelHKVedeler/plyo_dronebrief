import { briefSchema, type DroneBrief } from '../model/brief'

const PREFIX = 'dronebrief:draft:v1:'
const LAST_DRAFT = 'dronebrief:last-draft:v1'
export interface BriefRepository {
  save(brief: DroneBrief): void
  get(id: string): DroneBrief | null
  latest(): DroneBrief | null
}

// Storage is accessed lazily so SSR, tests and disabled storage can be handled by callers.
export const briefRepository: BriefRepository = {
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

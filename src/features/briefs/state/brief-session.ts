import { briefSchema, defaultVisibility, type BriefMode, type DroneBrief, type LayerVisibility } from '../model/brief'
import { recordMapHistory, restoreMapHistory, type MapHistory } from './map-history'

export type BriefSession = { brief: DroneBrief; mode: BriefMode; visibility: LayerVisibility; history: MapHistory }
export type BriefAction =
  | { type: 'update'; update: (brief: DroneBrief) => DroneBrief }
  | { type: 'update'; history: 'undo' | 'redo' }
  | { type: 'visibility'; layer: keyof LayerVisibility; visible: boolean }

export function openSession(brief: DroneBrief, mode: BriefMode): BriefSession {
  return { brief, mode, visibility: { ...defaultVisibility }, history: { past: [], future: [] } }
}

export function reduceSession(session: BriefSession, action: BriefAction): BriefSession {
  if (action.type === 'visibility') {
    return { ...session, visibility: { ...session.visibility, [action.layer]: action.visible } }
  }
  // The mutation boundary enforces viewer behavior even if a control is accidentally rendered.
  if (session.mode !== 'edit') return session
  if ('history' in action) {
    const undo = action.history === 'undo'
    const from = undo ? session.history.past : session.history.future
    const entry = from.at(-1)
    if (!entry) return session
    const brief = briefSchema.parse(restoreMapHistory(session.brief, entry, action.history))
    return {
      ...session, brief: { ...brief, updatedAt: new Date().toISOString() },
      history: undo
        ? { past: from.slice(0, -1), future: [...session.history.future, entry] }
        : { past: [...session.history.past, entry], future: from.slice(0, -1) },
    }
  }
  const updated = action.update(structuredClone(session.brief))
  const brief = briefSchema.parse(updated)
  if (JSON.stringify(updated) === JSON.stringify(session.brief)) return session
  return {
    ...session, brief: { ...brief, updatedAt: new Date().toISOString() },
    history: recordMapHistory(session.history, session.brief, brief),
  }
}

import { briefSchema, defaultVisibility, type BriefMode, type DroneBrief, type LayerVisibility } from '../model/brief'

export type BriefSession = { brief: DroneBrief; mode: BriefMode; visibility: LayerVisibility }
export type BriefAction =
  | { type: 'update'; update: (brief: DroneBrief) => DroneBrief }
  | { type: 'visibility'; layer: keyof LayerVisibility; visible: boolean }

export function openSession(brief: DroneBrief, mode: BriefMode): BriefSession {
  return { brief, mode, visibility: { ...defaultVisibility } }
}

export function reduceSession(session: BriefSession, action: BriefAction): BriefSession {
  if (action.type === 'visibility') {
    return { ...session, visibility: { ...session.visibility, [action.layer]: action.visible } }
  }
  // The mutation boundary enforces viewer behavior even if a control is accidentally rendered.
  if (session.mode !== 'edit') return session
  const brief = briefSchema.parse(action.update(structuredClone(session.brief)))
  return { ...session, brief: { ...brief, updatedAt: new Date().toISOString() } }
}

import type { DroneBrief } from '../model/brief'
import type { BriefingContent } from '../storage/public-brief-link'

/** Photo briefs and drone scans are shared as separate public links. */
export function briefingContentBrief(brief: DroneBrief, content: BriefingContent): DroneBrief {
  if (content === 'photo') return { ...brief, droneScan: null, angles: brief.angles.filter((angle) => angle.type !== 'extra-coverage') }
  if (content === 'scan') return { ...brief, circleRig: null, angles: brief.angles.filter((angle) => angle.type === 'extra-coverage') }
  return brief
}

export function briefingContentAvailable(brief: DroneBrief): Record<Exclude<BriefingContent, 'all'>, boolean> {
  return {
    photo: !!brief.circleRig || brief.angles.some((angle) => angle.type !== 'extra-coverage'),
    scan: !!(brief.droneScan?.highRes || brief.droneScan?.lowRes) || brief.angles.some((angle) => angle.type === 'extra-coverage'),
  }
}

/** Link variants worth offering; an empty brief still gets a photo brief link. */
export function briefingLinkContents(brief: DroneBrief): Exclude<BriefingContent, 'all'>[] {
  const available = briefingContentAvailable(brief)
  const contents = (['photo', 'scan'] as const).filter((content) => available[content])
  return contents.length ? contents : ['photo']
}

import type { DroneBrief } from '../model/brief'

export function reorderCameras(brief: DroneBrief, sourceId: string, targetId: string): DroneBrief {
  const source = brief.angles.find((angle) => angle.id === sourceId)
  const target = brief.angles.find((angle) => angle.id === targetId)
  if (!source || !target || source.id === target.id || source.type !== target.type) return brief
  const category = brief.angles.filter((angle) => angle.type === source.type)
  const from = category.findIndex((angle) => angle.id === sourceId)
  const to = category.findIndex((angle) => angle.id === targetId)
  category[from] = target
  category[to] = source
  let index = 0
  return { ...brief, angles: brief.angles.map((angle) => angle.type === source.type ? category[index++] : angle) }
}

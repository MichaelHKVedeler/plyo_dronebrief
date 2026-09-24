import { z } from 'zod'

export const positionSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
})
const heading = z.number().finite().min(0).lt(360)
const name = z.string().trim().min(1).max(200)
const id = z.string().min(1).max(100)
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const maxShootSlots = 3
// Additive v1: endTime makes a shoot a same-day range. Older snapshots are single times.
export const shootSchema = z.object({ date: z.iso.date(), time: clockTime, endTime: clockTime.optional() })
  .refine((slot) => !slot.endTime || slot.endTime > slot.time, {
    message: 'The end time must be later than the start time on the same day.', path: ['endTime'],
  })
export const projectSchema = z.object({
  name,
  clientName: name,
  description: z.string().max(2000).default(''),
  instructions: z.string().max(2000).default(''),
  date: z.iso.date(),
  times: z.array(clockTime).min(1).max(24),
  shoots: z.array(shootSchema).max(maxShootSlots).optional(),
})
const angleBase = { id, label: name, position: positionSchema }
export const min360Fov = 10
export const max360Fov = 180
// Additive v1: a panorama can optionally highlight a viewing sector.
const panoramaFocusSchema = z.object({
  directionDegrees: heading,
  fovDegrees: z.number().finite().min(min360Fov).max(max360Fov),
})
export type PanoramaFocus = z.infer<typeof panoramaFocusSchema>
export const angleSchema = z.discriminatedUnion('type', [
  z.object({ ...angleBase, type: z.literal('drone-image'), directionDegrees: heading }),
  // Additive v1: optional heightsMeters overrides the shared 360 height list for this point.
  z.object({
    ...angleBase, type: z.literal('360'), focus: panoramaFocusSchema.optional(),
    heightsMeters: z.array(z.number().finite().min(0).max(10000)).max(50).optional(),
  }),
  z.object({ ...angleBase, type: z.literal('dslr'), directionDegrees: heading }),
])
const heights = z.object({ heightsMeters: z.array(z.number().finite().min(0).max(10000)).max(50) })
const imageSourceSchema = z.union([
  z.string().max(1_500_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
  z.object({ kind: z.literal('local-file'), fileId: z.uuid(), fileName: z.string().min(1).max(255) }),
])
export const defaultRigArrowCount = 10
export const maxRigArrows = 50
export const maxDslrAngles = 12
export const minDslrSpacing = 15
export function maxDslrSpacing(angleCount: number) { return Math.floor(360 / angleCount) }
// Additive v1 settings: old briefs retain one arrow and their original height data.
const dslrSettings = heights.extend({
  angleCount: z.number().int().min(1).max(maxDslrAngles).default(1),
  spacingDegrees: z.number().int().min(minDslrSpacing).max(360).default(30),
}).refine((settings) => settings.spacingDegrees <= maxDslrSpacing(settings.angleCount), {
  message: 'DSLR arrows must leave room for every angle without overlapping.', path: ['spacingDegrees'],
})
export const briefSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  project: projectSchema,
  coordinates: positionSchema,
  circleRig: z.object({
    id, position: positionSchema,
    arrowCount: z.number().int().min(1).max(maxRigArrows).default(defaultRigArrowCount),
    radiusMeters: z.number().finite().positive().max(10000),
    ovalRatio: z.number().finite().min(0.1).max(1),
    rotationDegrees: heading,
  }).nullable(),
  angles: z.array(angleSchema).max(1000),
  typeSettings: z.object({ 'drone-image': heights, '360': heights, dslr: dslrSettings }),
  polygons: z.array(z.object({
    id, label: name, vertices: z.array(positionSchema).min(3).max(1000),
  })).max(100),
  imageOverlays: z.array(z.object({
    id, name,
    // Additive v1 source variant. Existing embedded sources retain their meaning.
    source: imageSourceSchema,
    position: positionSchema,
    widthMeters: z.number().finite().positive().max(10000),
    heightMeters: z.number().finite().positive().max(10000),
    rotationDegrees: heading,
    opacity: z.number().finite().min(0).max(1),
  })).max(10),
  // Additive v1: optional reference photos for PDF and public briefing. Older snapshots omit them.
  references: z.array(z.object({
    id, caption: z.string().trim().min(1).max(200), source: imageSourceSchema,
  })).max(4).default([]),
})

export type DroneBrief = z.infer<typeof briefSchema>
export type ImageOverlay = DroneBrief['imageOverlays'][number]
export type BriefReference = DroneBrief['references'][number]
export type ImageSource = ImageOverlay['source']
export type ProjectDetails = z.infer<typeof projectSchema>
export type ShootSlot = z.infer<typeof shootSchema>
export type Position = z.infer<typeof positionSchema>
export type CameraAngle = z.infer<typeof angleSchema>
export type BriefMode = 'edit' | 'view'
export type LayerVisibility = { circleRig: boolean; angles: boolean; polygons: boolean; imageOverlays: boolean }
export const defaultVisibility: LayerVisibility = { circleRig: true, angles: true, polygons: true, imageOverlays: true }
export const cameraTypes = ['drone-image', '360', 'dslr'] as const
export const cameraLabels = { 'drone-image': 'Drone image', '360': '360', dslr: 'DSLR' }

export function todayIsoDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function shootSlots(project: ProjectDetails): ShootSlot[] {
  if (project.shoots?.length) return project.shoots.slice(0, maxShootSlots)
  return project.times.slice(0, maxShootSlots).map((time) => ({ date: project.date, time }))
}

export function formatShootTime(slot: ShootSlot) {
  return slot.endTime ? `${slot.time} - ${slot.endTime}` : slot.time
}

export function projectWithShoots(project: ProjectDetails, shoots: ShootSlot[]): ProjectDetails {
  const next = shoots.slice(0, maxShootSlots)
  if (!next.length) return project
  return { ...project, date: next[0].date, times: next.map((shoot) => shoot.time), shoots: next }
}

export const floorHeightMeters = 3
export const defaultDroneHeights = [40, 60]
export const default360Heights = [2, 5, 8]
export const defaultShootTime = '07:00'
export const defaultShootEndTime = '17:00'

export function effectivePanoramaHeights(shared: number[], angle: { heightsMeters?: number[] }) {
  return angle.heightsMeters ?? shared
}

export function next360FloorHeight(heights: number[]) {
  return (heights.at(-1) ?? default360Heights[0] - floorHeightMeters) + floorHeightMeters
}

export function parseHeightsMeters(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []
  const tokens = trimmed.split(',').map((item) => item.trim())
  while (tokens.at(-1) === '') tokens.pop()
  const heightsMeters = tokens.map((item) => item ? Number(item) : NaN)
  if (heightsMeters.length > 50 || heightsMeters.some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) return null
  return heightsMeters
}

export function formatHeightsMeters(heights: number[]) {
  return heights.join(', ')
}

export function nextShootSlot(slots: ShootSlot[]): ShootSlot {
  return {
    date: slots.at(-1)?.date ?? todayIsoDate(),
    time: defaultShootTime,
    endTime: defaultShootEndTime,
  }
}

/** Every slider is a range. A stored instant keeps its start and gains 17:00 when that is later. */
export function ensureShootRange(slot: ShootSlot): ShootSlot {
  if (slot.endTime && slot.endTime > slot.time) return slot
  if (slot.time < defaultShootEndTime) return { ...slot, endTime: defaultShootEndTime }
  if (slot.time < '23:59') return { ...slot, endTime: '23:59' }
  return { date: slot.date, time: '23:44', endTime: '23:59' }
}

export function createBrief(project: Pick<ProjectDetails, 'name' | 'clientName'> & Partial<ProjectDetails>): DroneBrief {
  const now = new Date().toISOString()
  const date = project.date ?? todayIsoDate()
  const hasSchedule = project.times !== undefined || project.shoots !== undefined
  return briefSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    project: {
      date, times: [defaultShootTime],
      ...(hasSchedule ? {} : { shoots: [{ date, time: defaultShootTime, endTime: defaultShootEndTime }] }),
      ...project,
    },
    coordinates: { lat: 59.9139, lng: 10.7522 }, circleRig: null,
    angles: [], typeSettings: {
      'drone-image': { heightsMeters: defaultDroneHeights },
      '360': { heightsMeters: default360Heights }, dslr: { heightsMeters: [1.6] },
    },
    polygons: [], imageOverlays: [], references: [],
  })
}

export function localFileSources(brief: Pick<DroneBrief, 'imageOverlays' | 'references'>) {
  return [...brief.imageOverlays, ...brief.references].flatMap((item) => typeof item.source === 'string' ? [] : [item.source])
}

export function hasLocalFiles(brief: Pick<DroneBrief, 'imageOverlays' | 'references'>) {
  return localFileSources(brief).length > 0
}

import { z } from 'zod'

export const positionSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
})
const heading = z.number().finite().min(0).lt(360)
const name = z.string().trim().min(1).max(200)
const id = z.string().min(1).max(100)
export const projectSchema = z.object({
  name,
  clientName: name,
  date: z.iso.date(),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24),
})
const angleBase = { id, label: name, position: positionSchema }
export const angleSchema = z.discriminatedUnion('type', [
  z.object({ ...angleBase, type: z.literal('drone-image'), directionDegrees: heading }),
  z.object({ ...angleBase, type: z.literal('360') }),
  z.object({ ...angleBase, type: z.literal('dslr'), directionDegrees: heading }),
])
const heights = z.object({ heightsMeters: z.array(z.number().finite().min(0).max(10000)).max(50) })
export const briefSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  project: projectSchema,
  coordinates: positionSchema,
  circleRig: z.object({
    id, position: positionSchema,
    radiusMeters: z.number().finite().positive().max(10000),
    ovalRatio: z.number().finite().min(0.1).max(1),
    rotationDegrees: heading,
  }).nullable(),
  angles: z.array(angleSchema).max(1000),
  typeSettings: z.object({ 'drone-image': heights, '360': heights, dslr: heights }),
  polygons: z.array(z.object({
    id, label: name, vertices: z.array(positionSchema).min(3).max(1000),
  })).max(100),
  imageOverlays: z.array(z.object({
    id, name,
    source: z.string().max(1_500_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
    position: positionSchema,
    widthMeters: z.number().finite().positive().max(10000),
    heightMeters: z.number().finite().positive().max(10000),
    rotationDegrees: heading,
    opacity: z.number().finite().min(0).max(1),
  })).max(10),
})

export type DroneBrief = z.infer<typeof briefSchema>
export type ProjectDetails = z.infer<typeof projectSchema>
export type Position = z.infer<typeof positionSchema>
export type CameraAngle = z.infer<typeof angleSchema>
export type BriefMode = 'edit' | 'view'
export type LayerVisibility = { circleRig: boolean; angles: boolean; polygons: boolean; imageOverlays: boolean }
export const defaultVisibility: LayerVisibility = { circleRig: true, angles: true, polygons: true, imageOverlays: true }
export const cameraTypes = ['drone-image', '360', 'dslr'] as const
export const cameraLabels = { 'drone-image': 'Drone image', '360': '360', dslr: 'DSLR' }

export function createBrief(project: ProjectDetails): DroneBrief {
  const now = new Date().toISOString()
  return briefSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    project, coordinates: { lat: 59.9139, lng: 10.7522 }, circleRig: null,
    angles: [], typeSettings: {
      'drone-image': { heightsMeters: [30, 60] },
      '360': { heightsMeters: [30] }, dslr: { heightsMeters: [1.6] },
    },
    polygons: [], imageOverlays: [],
  })
}

import { gzipSync } from 'node:zlib'
import { z } from 'zod'

// dronesoner.no publishes Norway's drone geozones (NLOD 2.0) as a dated ED-269 file, updated monthly.
const site = 'https://dronesoner.no/'
const cacheMilliseconds = 6 * 60 * 60 * 1000
const maxSourceBytes = 50 * 1024 * 1024

const ring = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4)
const zoneSchema = z.object({
  name: z.string().max(500),
  restriction: z.string().max(64),
  geometry: z.array(z.object({ horizontalProjection: z.looseObject({ type: z.string(), coordinates: z.unknown() }) })),
})

export type DroneZoneFeature = {
  type: 'Feature'
  properties: { name: string; restriction: string }
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

/** Keeps the polygons, the zone name and its restriction; anything malformed is left out rather than guessed. */
export function zonesToGeoJson(source: unknown) {
  const features: DroneZoneFeature[] = []
  for (const item of z.array(z.unknown()).parse(source)) {
    const zone = zoneSchema.safeParse(item)
    if (!zone.success) continue
    for (const { horizontalProjection } of zone.data.geometry) {
      if (horizontalProjection.type !== 'Polygon') continue
      const rings = z.array(ring).min(1).safeParse(horizontalProjection.coordinates)
      if (rings.success) features.push({ type: 'Feature', properties: { name: zone.data.name, restriction: zone.data.restriction }, geometry: { type: 'Polygon', coordinates: rings.data } })
    }
  }
  if (!features.length) throw new Error('The drone zone file had no usable zones.')
  return { type: 'FeatureCollection' as const, features }
}

export function latestZoneFile(html: string) {
  const files = [...html.matchAll(/Downloads\/NOR_ED269_compliant_geozones_(\d{4}-\d{2}-\d{2})\.json/g)].map((match) => match[0]).sort()
  const latest = files.at(-1)
  if (!latest) throw new Error('No ED-269 file is linked from dronesoner.no.')
  return new URL(latest, site).href
}

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`)
  const text = await response.text()
  if (text.length > maxSourceBytes) throw new Error('The drone zone file is unexpectedly large.')
  return text
}

let cache: { json: string; gzip: Buffer; expires: number } | undefined
/** Serves from memory for six hours, and keeps serving the last good copy if dronesoner.no is down. */
export async function droneZones(now = Date.now()) {
  if (cache && cache.expires > now) return cache
  try {
    const json = JSON.stringify(zonesToGeoJson(JSON.parse(await download(latestZoneFile(await download(site))))))
    cache = { json, gzip: gzipSync(json), expires: now + cacheMilliseconds }
  } catch (error) {
    if (!cache) throw error
    console.warn('Serving cached drone zones', error)
    cache = { ...cache, expires: now + 10 * 60 * 1000 } // retry later, not on every request

  }
  return cache
}

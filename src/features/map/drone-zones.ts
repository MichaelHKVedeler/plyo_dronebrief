import { useEffect, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import { droneZonesEndpoint } from '@/features/cloud/auth/firebase'

export type DroneZones = FeatureCollection<Polygon, { name: string; restriction: string }>

/** REQ_AUTHORISATION needs permission (airports, nature, sensitive sites); CONDITIONAL has conditions. */
export const droneZoneColors = { authorisation: '#dc2626', conditional: '#d97706' }
export const droneZoneAttribution = 'Drone zones: dronesoner.no (NLOD 2.0)'

let request: Promise<DroneZones | null> | undefined
function loadDroneZones() {
  const url = droneZonesEndpoint()
  if (!url) return Promise.resolve(null)
  request ??= fetch(url).then(async (response) => {
    if (!response.ok) throw new Error('Drone zones are unavailable right now.')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features)) throw new Error('Drone zones are unavailable right now.')
    return data as DroneZones
  }).catch((error: unknown) => { request = undefined; throw error })
  return request
}

/** Loads once per page, and only after the layer is first shown. */
export function useDroneZones(visible: boolean) {
  const [state, setState] = useState<{ zones: DroneZones | null; error: string }>({ zones: null, error: '' })
  useEffect(() => {
    if (!visible || state.zones) return
    let live = true
    loadDroneZones().then((zones) => { if (live) setState({ zones, error: '' }) },
      (error: unknown) => { if (live) setState({ zones: null, error: error instanceof Error ? error.message : 'Drone zones are unavailable right now.' }) })
    return () => { live = false }
  }, [visible, state.zones])
  return state
}

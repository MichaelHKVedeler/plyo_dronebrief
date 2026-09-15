import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { MapView } from './map-view'

export function GoogleMapView({ active, satellite, view }: { active: boolean; satellite: boolean; view: RefObject<MapView> }) {
  const map = useMap()
  const previousActive = useRef(active)
  useEffect(() => {
    if (!map) return
    // Advanced markers require a map ID. Google requires labels to be styled
    // through that ID's published cloud style, not StyledMapType or inline styles.
    map.setMapTypeId(satellite ? 'satellite' : 'roadmap')
  }, [map, satellite])
  useLayoutEffect(() => {
    if (map && active && !previousActive.current) map.moveCamera({ center: view.current.center, zoom: view.current.zoom, heading: 0, tilt: 0 })
    previousActive.current = active
  }, [map, active, view])
  return null
}

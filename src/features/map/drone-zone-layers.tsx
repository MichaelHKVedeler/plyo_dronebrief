import { useContext, useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { ExpressionSpecification } from 'maplibre-gl'
import { ShadeProjection } from './shade-projection'
import { droneZoneColors, type DroneZones } from './drone-zones'

const color = (restriction: unknown) => restriction === 'CONDITIONAL' ? droneZoneColors.conditional : droneZoneColors.authorisation

/** Google Maps: a Data layer below the brief's own objects. Not clickable, so placement clicks reach the map. */
export function GoogleDroneZones({ zones }: { zones: DroneZones }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const layer = new google.maps.Data({ map })
    layer.addGeoJson(zones)
    layer.setStyle((feature) => ({ clickable: false, fillColor: color(feature.getProperty('restriction')), fillOpacity: 0.12, strokeColor: color(feature.getProperty('restriction')), strokeOpacity: 0.7, strokeWeight: 1.5, zIndex: 0 }))
    return () => layer.setMap(null)
  }, [map, zones])
  return null
}

/** ShadeMap (MapLibre): fill and outline inserted under the brief layers. */
export function ShadeDroneZones({ zones }: { zones: DroneZones }) {
  const map = useContext(ShadeProjection)
  useEffect(() => {
    if (!map) return
    const before = map.getLayer('brief-fill') ? 'brief-fill' : undefined
    const paintColor: ExpressionSpecification = ['match', ['get', 'restriction'], 'CONDITIONAL', droneZoneColors.conditional, droneZoneColors.authorisation]
    map.addSource('drone-zones', { type: 'geojson', data: zones })
    map.addLayer({ id: 'drone-zones-fill', type: 'fill', source: 'drone-zones', paint: { 'fill-color': paintColor, 'fill-opacity': 0.12 } }, before)
    map.addLayer({ id: 'drone-zones-outline', type: 'line', source: 'drone-zones', paint: { 'line-color': paintColor, 'line-opacity': 0.7, 'line-width': 1.5 } }, before)
    return () => {
      try {
        for (const id of ['drone-zones-outline', 'drone-zones-fill']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource('drone-zones')) map.removeSource('drone-zones')
      } catch { /* The map was already removed with the ShadeMap panel. */ }
    }
  }, [map, zones])
  return null
}

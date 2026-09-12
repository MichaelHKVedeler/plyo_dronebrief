import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { ShadeProjection } from './shade-projection'
import { attachRigLineDrag, type RigLineDragProps, type RigProjection } from './rig-line-drag'

export function RigLineDragController(props: RigLineDragProps) {
  const googleMap = useMap()
  const shadeMap = useContext(ShadeProjection)
  const latest = useRef(props)
  useLayoutEffect(() => { latest.current = props })
  useEffect(() => {
    if (shadeMap) return attachRigLineDrag(shadeMap.getContainer().parentElement!, {
      project: (p) => shadeMap.project([p.lng, p.lat]),
      unproject: (p) => { const value = shadeMap.unproject([p.x, p.y]); return { lat: value.lat, lng: value.lng } },
    }, () => latest.current, (target) => target === shadeMap.getCanvas() || (target instanceof Element && !!target.closest('[data-rig-outline]')))
    if (!googleMap) return
    const surface = googleMap.getDiv()
    const view = () => {
      const projection = googleMap.getProjection(), center = googleMap.getCenter(), zoom = googleMap.getZoom()
      const origin = center && projection?.fromLatLngToPoint(center)
      return projection && origin && zoom !== undefined ? { projection, origin, scale: 2 ** zoom } : null
    }
    const projection: RigProjection = {
      project: (p) => {
        const v = view()
        const world = v?.projection.fromLatLngToPoint(new google.maps.LatLng(p))
        if (!v || !world) return null
        // Use the world copy nearest the map center at the antimeridian.
        const dx = ((world.x - v.origin.x + 384) % 256) - 128
        return { x: surface.clientWidth / 2 + dx * v.scale, y: surface.clientHeight / 2 + (world.y - v.origin.y) * v.scale }
      },
      unproject: (p) => {
        const v = view()
        return v?.projection.fromPointToLatLng(new google.maps.Point(v.origin.x + (p.x - surface.clientWidth / 2) / v.scale, v.origin.y + (p.y - surface.clientHeight / 2) / v.scale))?.toJSON() ?? null
      },
    }
    return attachRigLineDrag(surface, projection, () => latest.current)
  }, [googleMap, shadeMap, props.interactive])
  return null
}

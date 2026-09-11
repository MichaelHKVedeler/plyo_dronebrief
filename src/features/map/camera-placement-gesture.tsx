import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { attachPlacementGesture, type PlacementGestureProps } from './placement-gesture'
import type { Position } from '@/features/briefs/model/brief'

export function CameraPlacementGesture(props: PlacementGestureProps) {
  const map = useMap()
  const latest = useRef(props)
  useLayoutEffect(() => { latest.current = props })
  const type = props.tool.kind === 'camera' ? props.tool.cameraType : null
  useEffect(() => {
    if (!map || !type) return
    const surface = map.getDiv()
    function point(event: PointerEvent): Position | null {
      const projection = map!.getProjection()
      const center = map!.getCenter()
      const zoom = map!.getZoom()
      const origin = center && projection?.fromLatLngToPoint(center)
      if (!projection || !origin || zoom === undefined) return null
      const rect = surface.getBoundingClientRect()
      return projection.fromPointToLatLng(new google.maps.Point(
        origin.x + (event.clientX - rect.left - rect.width / 2) / 2 ** zoom,
        origin.y + (event.clientY - rect.top - rect.height / 2) / 2 ** zoom,
      ))?.toJSON() ?? null
    }
    return attachPlacementGesture(surface, point, () => latest.current)
  }, [map, type])
  return null
}

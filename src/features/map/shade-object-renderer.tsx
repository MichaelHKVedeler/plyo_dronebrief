import { forwardRef, useContext, useRef, useEffect, type PointerEvent } from 'react'
import type { PolygonProps } from '@vis.gl/react-google-maps'
import { ShadeProjection } from './shade-projection'
import type { ObjectMarkerProps } from './object-renderer'
import type { Position } from '@/features/briefs/model/brief'

const literal = (point: google.maps.LatLng | google.maps.LatLngLiteral): Position => 'toJSON' in point ? point.toJSON() : point

// Capturing the pointer keeps touch/mouse drags on the object, off the map.
export const ShadeMarker = forwardRef<google.maps.marker.AdvancedMarkerElement, ObjectMarkerProps>(function ShadeMarker(props, _ref) {
  const map = useContext(ShadeProjection)!
  const drag = useRef<{ target: Element; id: number; x: number; y: number; offsetX: number; offsetY: number; started: boolean } | null>(null)
  const suppressClick = useRef(false)
  const onCancel = props.onDragCancel
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) { onCancel?.(); drag.current = null; suppressClick.current = true }
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [onCancel])
  if (!props.position) return null
  const position = literal(props.position as google.maps.LatLngLiteral)
  const pixel = map.project([position.lng, position.lat])
  function eventAt(event: PointerEvent<HTMLDivElement>): google.maps.MapMouseEvent {
    const rect = event.currentTarget.parentElement!.getBoundingClientRect()
    const point = map.unproject([event.clientX - rect.left - (drag.current?.offsetX ?? 0), event.clientY - rect.top - (drag.current?.offsetY ?? 0)])
    // Only the provider-independent toJSON contract is consumed by object tools.
    return { latLng: { toJSON: () => ({ lat: point.lat, lng: point.lng }) } as google.maps.LatLng, domEvent: event.nativeEvent, stop: () => event.stopPropagation() }
  }
  return <div data-shade-object title={props.title ?? undefined} className="absolute" style={{ left: pixel.x, top: pixel.y, transform: 'translate(-50%, -50%)', zIndex: props.zIndex ?? 20, pointerEvents: props.clickable || props.draggable ? 'auto' : 'none', touchAction: 'none', ...props.style }}
    onMouseEnter={(e) => props.onMouseEnter?.(e.nativeEvent)} onMouseLeave={(e) => props.onMouseLeave?.(e.nativeEvent)}
    onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false } }}
    onClick={(e) => e.stopPropagation()}
    onPointerDown={(e) => {
      if (!props.draggable || e.button !== 0 || e.ctrlKey || e.shiftKey) return
      e.stopPropagation()
      suppressClick.current = false
      const rect = e.currentTarget.parentElement!.getBoundingClientRect()
      const target = (e.target as Element).closest('button') ?? e.currentTarget
      drag.current = { target, id: e.pointerId, x: e.clientX, y: e.clientY, offsetX: e.clientX - rect.left - pixel.x, offsetY: e.clientY - rect.top - pixel.y, started: false }
      target.setPointerCapture(e.pointerId)
    }}
    onPointerMove={(e) => {
      const current = drag.current
      if (!props.draggable || !current || current.id !== e.pointerId) return
      e.stopPropagation()
      if (!current.started && Math.hypot(e.clientX - current.x, e.clientY - current.y) < 3) return
      if (!current.started) { current.started = true; props.onDragStart?.(eventAt(e)) }
      props.onDrag?.(eventAt(e))
    }}
    onPointerUp={(e) => {
      if (!drag.current || drag.current.id !== e.pointerId) return
      e.stopPropagation()
      if (drag.current.started && props.draggable) { suppressClick.current = true; props.onDragEnd?.(eventAt(e)) }
      const target = drag.current.target
      drag.current = null
      target.releasePointerCapture(e.pointerId)
    }}
    onLostPointerCapture={() => { if (drag.current) { props.onDragCancel?.(); drag.current = null } }}
    onPointerCancel={() => { props.onDragCancel?.(); drag.current = null; suppressClick.current = true }}>{props.children}</div>
})

export const ShadePolygon = forwardRef<google.maps.Polygon, PolygonProps>(function ShadePolygon(props, _ref) {
  const map = useContext(ShadeProjection)!
  const points = (props.paths as Position[]).map((point) => { const p = map.project([point.lng, point.lat]); return `${p.x},${p.y}` }).join(' ')
  return <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
    <polygon data-shade-pan-surface points={points} stroke={props.strokeColor ?? undefined} strokeWidth={props.strokeWeight ?? undefined} fill={props.fillColor ?? undefined} fillOpacity={props.fillOpacity ?? undefined}
      style={{ pointerEvents: props.clickable ? 'auto' : 'none', touchAction: 'none' }}
      onMouseEnter={(e) => props.onMouseOver?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent)}
      onMouseLeave={(e) => props.onMouseOut?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent)}
      onClick={(e) => { e.stopPropagation(); props.onClick?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent) }} />
    {props.clickable && <polygon data-shade-object data-rig-outline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(12, props.strokeWeight ?? 0)}
      style={{ pointerEvents: 'stroke', touchAction: 'none', cursor: 'pointer' }}
      onMouseEnter={(e) => props.onMouseOver?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent)}
      onMouseLeave={(e) => props.onMouseOut?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent)}
      onClick={(e) => { e.stopPropagation(); props.onClick?.({ domEvent: e.nativeEvent } as google.maps.MapMouseEvent) }} />}
  </svg>
})

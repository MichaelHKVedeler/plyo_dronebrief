import { useRef, useState, type ReactNode } from 'react'
import { useObjectRenderer } from './object-renderer'
import { Button } from '@/components/ui/button'
import type { Position } from '@/features/briefs/model/brief'
import { useMapObjectScale } from './map-object-scale'

type Props = {
  bare?: boolean
  interactive?: boolean
  position: Position
  label: string
  children: ReactNode
  onCancel?: () => void
  onStart: () => void
  onPreview: (position: Position) => void
  onCommit: (position: Position) => void
  onEnter: () => void
  onLeave: () => void
  onStep?: (delta: number) => void
  className?: string
  constrain?: (position: Position) => Position
  hitAreaOnly?: boolean
}
export function MapHandle({ position, label, children, onCancel, onStart, onPreview, onCommit, onEnter, onLeave, onStep, constrain, bare = false, interactive = true, hitAreaOnly = false, className = '' }: Props) {
  const { Marker: AdvancedMarker } = useObjectRenderer()
  const scale = useMapObjectScale()
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [focused, setFocused] = useState(false)
  const handleClass = 'transition-none ' + (bare
    ? 'touch-none border-0 bg-transparent text-primary shadow-none hover:bg-transparent dark:hover:bg-transparent disabled:opacity-100 '
    : 'touch-none rounded-full border-2 border-primary bg-card text-primary shadow-md dark:bg-card dark:border-primary dark:hover:bg-secondary ') + className
  function drag(point: Position, commit: boolean) {
    if (!interactive) return
    const constrained = constrain ? constrain(point) : point
    // The SDK moves draggable markers independently of React's position prop.
    // Apply the constraint on every event, even when the shape is at its limit.
    if (constrain && marker.current) marker.current.position = constrained
    if (commit) onCommit(constrained)
    else onPreview(constrained)
  }
  return <>
    {/* A constrained handle's visible marker never participates in SDK dragging.
        Its position and the outline are rendered from the same shape state. */}
    {constrain && !hitAreaOnly && <AdvancedMarker position={position} anchorLeft="-50%" anchorTop="-50%" zIndex={100}
      draggable={false} clickable={false} style={{ pointerEvents: 'none' }}>
      {/* Direction symbols are geometry, not a second button. A circular button
          surface/focus ring must never be painted over the arrow. */}
      {bare ? <span aria-hidden="true" className={'flex size-8 items-center justify-center' + (focused ? ' [&_svg]:drop-shadow-[0_0_2px_var(--ring)]' : '')}
        style={{ zoom: scale }}>{children}</span>
      : <Button aria-hidden="true" tabIndex={-1} disabled={!interactive} type="button" size="icon-sm" variant="outline"
        style={{ zoom: scale }}
        className={handleClass + (focused ? ' ring-2 ring-ring' : '')}>{children}</Button>}
    </AdvancedMarker>}
    <AdvancedMarker ref={marker} position={position} anchorLeft="-50%" anchorTop="-50%" zIndex={101}
    title={label} draggable={interactive} clickable={interactive} style={{ pointerEvents: interactive ? 'auto' : 'none', opacity: constrain ? 0 : 1 }}
    onMouseEnter={onEnter} onMouseLeave={onLeave}
    onDragCancel={onCancel}
    onDragStart={() => { if (interactive) onStart() }}
    onDrag={(event) => { if (event.latLng) drag(event.latLng.toJSON(), false) }}
    onDragEnd={(event) => { if (event.latLng) drag(event.latLng.toJSON(), true) }}>
    <Button disabled={!interactive} type="button" size="icon-sm" variant={bare ? 'ghost' : 'outline'}
      style={{ zoom: scale }}
      className={handleClass}
      aria-label={label} title={label + ' · drag to adjust'}
      onFocus={(event) => { setFocused(event.currentTarget.matches(':focus-visible')); onEnter() }} onBlur={() => { setFocused(false); onLeave() }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!interactive || !onStep || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return
        event.preventDefault(); event.stopPropagation()
        onStep(event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1)
      }}>{children}</Button>
  </AdvancedMarker>
  </>
}

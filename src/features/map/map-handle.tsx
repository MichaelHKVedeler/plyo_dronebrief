import type { ReactNode } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { Button } from '@/components/ui/button'
import type { Position } from '@/features/briefs/model/brief'

type Props = {
  position: Position
  label: string
  children: ReactNode
  onStart: () => void
  onPreview: (position: Position) => void
  onCommit: (position: Position) => void
  onEnter: () => void
  onLeave: () => void
  onStep?: (delta: number) => void
  className?: string
}
export function MapHandle({ position, label, children, onStart, onPreview, onCommit, onEnter, onLeave, onStep, className = '' }: Props) {
  return <AdvancedMarker position={position} anchorLeft="-50%" anchorTop="-50%" zIndex={100}
    title={label} draggable
    onMouseEnter={onEnter} onMouseLeave={onLeave}
    onDragStart={onStart}
    onDrag={(event) => { if (event.latLng) onPreview(event.latLng.toJSON()) }}
    onDragEnd={(event) => { if (event.latLng) onCommit(event.latLng.toJSON()) }}>
    <Button type="button" size="icon-sm" variant="outline"
      className={'touch-none rounded-full border-2 border-primary bg-card text-primary shadow-md ' + className}
      aria-label={label} title={label + ' · drag to adjust'}
      onFocus={onEnter} onBlur={onLeave}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!onStep || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return
        event.preventDefault(); event.stopPropagation()
        onStep(event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1)
      }}>{children}</Button>
  </AdvancedMarker>
}

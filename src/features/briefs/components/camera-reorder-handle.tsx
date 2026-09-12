import { useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CameraAngle } from '../model/brief'

export type CameraDragPreview = { source: string; target: string; offset: number; step: number; settling: boolean }

type Drag = { y: number; grabOffset: number; height: number; scrollTop: number; viewport: HTMLElement | null; from: number; step: number; preview: CameraDragPreview }

export function CameraReorderHandle({ angle, name, points, onMove, onPreview }: {
  angle: CameraAngle; name: string; points: CameraAngle[]; onMove: (source: string, target: string) => void; onPreview: (preview: CameraDragPreview | null) => void
}) {
  const drag = useRef<Drag | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])
  function cancel() {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = null; drag.current = null; onPreview(null)
  }
  return <Button variant="ghost" size="icon" className="size-7 shrink-0 touch-none cursor-grab active:cursor-grabbing"
    aria-label={'Reorder ' + name} title="Drop onto another row to swap places. Up/Down swaps with the neighboring point."
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); return }
      if (drag.current || event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault(); event.stopPropagation()
      const index = points.findIndex((point) => point.id === angle.id)
      const target = points[index + (event.key === 'ArrowUp' ? -1 : 1)]
      if (target) onMove(angle.id, target.id)
    }}
    onPointerDown={(event) => {
      if (event.button !== 0 || drag.current) return
      event.stopPropagation()
      const row = event.currentTarget.closest<HTMLElement>('[data-camera-row]')!
      const rows = Array.from(row.parentElement!.querySelectorAll<HTMLElement>(':scope > [data-camera-row]'))
      const step = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : row.getBoundingClientRect().height
      const viewport = row.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
      const rect = row.getBoundingClientRect()
      const preview: CameraDragPreview = { source: angle.id, target: angle.id, offset: 0, step, settling: false }
      drag.current = { y: event.clientY, grabOffset: event.clientY - rect.top - rect.height / 2, height: rect.height, scrollTop: viewport?.scrollTop ?? 0, viewport, from: points.findIndex((point) => point.id === angle.id), step, preview }
      onPreview(preview)
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => {
      const current = drag.current
      if (!current || current.preview.settling) return
      const { viewport, from, step } = current
      if (viewport) {
        const bounds = viewport.getBoundingClientRect()
        if (event.clientY < bounds.top + 32) viewport.scrollBy(0, -12)
        else if (event.clientY > bounds.bottom - 32) viewport.scrollBy(0, 12)
      }
      const delta = event.clientY - current.y + (viewport?.scrollTop ?? 0) - current.scrollTop
      const offset = Math.max(-from * step, Math.min((points.length - 1 - from) * step, delta))
      // Target the stationary rows, independently of the lifted row.
      const pointerOffset = delta + current.grabOffset
      const nearest = Math.max(0, Math.min(points.length - 1, from + Math.round(pointerOffset / step)))
      const swap = nearest !== from && Math.abs(pointerOffset - (nearest - from) * step) <= current.height / 2
      current.preview = { ...current.preview, offset, target: swap ? points[nearest].id : angle.id }
      onPreview(current.preview)
    }}
    onPointerUp={(event) => {
      const current = drag.current
      if (!current) return
      const target = current.preview.target
      const to = points.findIndex((point) => point.id === target)
      current.preview = { ...current.preview, offset: (to - current.from) * current.step, settling: true }
      onPreview(current.preview)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      // Finish the landing animation before replacing the saved array order.
      settleTimer.current = setTimeout(() => {
        drag.current = null; settleTimer.current = null
        if (target !== angle.id) onMove(angle.id, target)
        onPreview(null)
      }, 160)
    }}
    onPointerCancel={cancel}
    onLostPointerCapture={() => { if (!drag.current?.preview.settling) cancel() }}><GripVertical /></Button>
}

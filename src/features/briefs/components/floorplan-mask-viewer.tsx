import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { PenTool, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageMask, ImageOverlay } from '../model/brief'
import { maskClipPath, moveMaskPoints, pointOnSegment } from '../model/image-mask'

const insertCursor = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M12 10v20M2 20h20M26 2v8M22 6h8" fill="none" stroke="white" stroke-width="4"/><path d="M12 10v20M2 20h20M26 2v8M22 6h8" fill="none" stroke="black" stroke-width="2"/></svg>')}" ) 12 20, crosshair`

const removeCursor = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M12 10v20M2 20h20M22 6h8" fill="none" stroke="white" stroke-width="4"/><path d="M12 10v20M2 20h20M22 6h8" fill="none" stroke="black" stroke-width="2"/></svg>')}") 12 20, crosshair`
type SelectionBox = { start: ImageMask[number]; end: ImageMask[number] }
function verticesInBox(points: ImageMask, box: SelectionBox) {
  return points.flatMap((point, index) => point.x >= Math.min(box.start.x, box.end.x) && point.x <= Math.max(box.start.x, box.end.x)
    && point.y >= Math.min(box.start.y, box.end.y) && point.y <= Math.max(box.start.y, box.end.y) ? [index] : [])
}

export function FloorplanMaskViewer({ overlay, url, editable, onChange }: {
  overlay: ImageOverlay; url: string; editable: boolean; onChange: (mask: ImageMask | undefined) => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const pointerInside = useRef(false)
  const drag = useRef<{ start: ImageMask[number]; original: ImageMask; indices: number[]; next: ImageMask; inserted?: boolean } | null>(null)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [altHeld, setAltHeld] = useState(false)
  const boxDrag = useRef<SelectionBox | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [dragCursor, setDragCursor] = useState<'crosshair'>()
  const [drawing, setDrawing] = useState(false)
  const [draft, setDraft] = useState<ImageMask>([])
  const [preview, setPreview] = useState<ImageMask | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const points = drawing ? draft : preview ?? overlay.mask ?? []
  const highlighted = selectionBox ? verticesInBox(points, selectionBox) : selected
  const editCursor = ctrlHeld && !drawing && points.length < 1000 ? insertCursor : 'crosshair'
  useEffect(() => {
    if (!editable) return
    const modifier = (event: KeyboardEvent) => {
      // Capture releases even when focused controls stop propagation. The released
      // key is authoritative; some hosts retain its modifier flag on keyup.
      const down = event.type === 'keydown'
      setCtrlHeld(event.key === 'Control' ? down : event.ctrlKey)
      setAltHeld(event.key === 'Alt' ? down : event.altKey)
      // Keep bare Alt from moving focus into the browser menu while editing.
      if (event.key === 'Alt' && pointerInside.current) event.preventDefault()
    }
    const blur = () => { boxDrag.current = null; setSelectionBox(null); setCtrlHeld(false); setAltHeld(false); drag.current = null; setDragCursor(undefined); setPreview(null); setSelected([]) }
    window.addEventListener('keydown', modifier, true)
    window.addEventListener('keyup', modifier, true)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', modifier, true); window.removeEventListener('keyup', modifier, true); window.removeEventListener('blur', blur) }
  }, [editable])
  function position(event: { clientX: number; clientY: number }) {
    const box = surface.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }
  }
  function cancel() { boxDrag.current = null; setSelectionBox(null); drag.current = null; setDragCursor(undefined); setPreview(null); setDrawing(false); setDraft([]); setSelected([]) }
  function removeVertices(indices: number[]) {
    const next = points.filter((_, index) => !indices.includes(index))
    onChange(next.length >= 3 ? next : undefined)
    setSelected([])
  }
  function startBox(event: PointerEvent<SVGElement>) {
    event.preventDefault(); event.stopPropagation(); surface.current?.focus()
    const start = position(event)
    boxDrag.current = { start, end: start }; setSelectionBox(boxDrag.current)
    surface.current?.setPointerCapture(event.pointerId)
  }
  function close() { if (draft.length >= 3) { onChange(draft); setDrawing(false); setDraft([]) } }
  function begin(event: PointerEvent<SVGElement>, indices: number[]) {
    if (!editable || drawing || event.button !== 0) return
    if (event.altKey && indices.length === 1) {
      event.preventDefault(); event.stopPropagation(); surface.current?.focus(); setAltHeld(true)
      removeVertices(indices); return
    }
    event.preventDefault(); event.stopPropagation()
    surface.current?.focus()
    setCtrlHeld(event.ctrlKey)
    const inserted = event.ctrlKey && indices.length === 2 && points.length < 1000
    let original = points
    if (inserted) {
      const next = [...points]
      next.splice(indices[0] + 1, 0, pointOnSegment(position(event), points[indices[0]], points[indices[1]]))
      indices = [indices[0] + 1]
      original = next
      setPreview(next)
    }
    const movingSelection = !inserted && indices.every((index) => selected.includes(index))
    if (movingSelection) indices = selected
    setSelected(indices.length === 1 || movingSelection ? indices : [])
    setDragCursor('crosshair')
    drag.current = { start: position(event), original, indices, next: original, inserted }
    surface.current?.setPointerCapture(event.pointerId)
  }
  return <div className="grid min-w-0 gap-3" data-mask-busy={drawing || selectionBox !== null || preview !== null || selected.length > 0}>
    {editable && <div className="flex flex-wrap items-center gap-2">
      <Button size="icon" variant={drawing ? 'default' : 'outline'} aria-label="Draw floorplan mask" title="Draw floorplan mask" aria-pressed={drawing} disabled={failed}
        onClick={() => { cancel(); setDrawing(!drawing); surface.current?.focus() }}><PenTool /></Button>
      <Button size="icon" variant="outline" aria-label="Remove floorplan mask" title="Remove floorplan mask" disabled={!overlay.mask || drawing}
        onClick={() => { cancel(); onChange(undefined) }}><Trash2 /></Button>
      <p id="mask-help" className="min-w-0 flex-1 text-xs text-muted-foreground">{drawing
        ? 'Click to add points. Right-click or click the first point to close (at least 3 points). Escape cancels.'
        : 'Ctrl+click to add points. Alt+click to delete points.'}</p>
    </div>}
    {failed && <p role="alert">Floorplan could not be loaded. Close this window and reconnect or retry the image.</p>}
    <div className="flex min-w-0 justify-center overflow-hidden rounded-md bg-muted">
      <div ref={surface} tabIndex={editable ? 0 : undefined} aria-label="Floorplan mask canvas" aria-describedby={editable ? 'mask-help' : undefined}
        className="relative max-w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ cursor: dragCursor ? editCursor : undefined }}
        onPointerEnter={(event) => { pointerInside.current = true; setCtrlHeld(event.ctrlKey); setAltHeld(event.altKey) }}
        onPointerLeave={() => { pointerInside.current = false }}
        onBlur={() => { boxDrag.current = null; setSelectionBox(null); if (drag.current) { drag.current = null; setDragCursor(undefined); setPreview(null); setSelected([]) } }}
        onKeyDown={(event) => {
          if (!editable) return
          if (event.key === 'Escape' && (drawing || boxDrag.current || drag.current || selected.length > 0)) { event.preventDefault(); event.stopPropagation(); cancel() }
          if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length > 0 && !drawing && !drag.current && !boxDrag.current) {
            event.preventDefault(); removeVertices(selected)
          }
        }}
        onPointerMove={(event) => {
          setCtrlHeld(event.ctrlKey); setAltHeld(event.altKey)
          if (boxDrag.current) { boxDrag.current = { ...boxDrag.current, end: position(event) }; setSelectionBox(boxDrag.current); return }
          const active = drag.current; if (!active) return
          const p = position(event)
          active.next = moveMaskPoints(active.original, active.indices, p.x - active.start.x, p.y - active.start.y)
          setPreview(active.next)
        }}
        onPointerUp={() => {
          if (boxDrag.current) { setSelected(verticesInBox(points, boxDrag.current)); boxDrag.current = null; setSelectionBox(null); return }
          const active = drag.current; if (!active) return; drag.current = null; setDragCursor(undefined); setPreview(null); if (active.inserted || active.next !== active.original) onChange(active.next)
        }}
        onPointerCancel={() => { boxDrag.current = null; setSelectionBox(null); drag.current = null; setDragCursor(undefined); setPreview(null); setSelected([]) }}
        onLostPointerCapture={() => { boxDrag.current = null; setSelectionBox(null); if (!drag.current) return; drag.current = null; setDragCursor(undefined); setPreview(null); setSelected([]) }}
        onContextMenu={(event) => { if (drawing) { event.preventDefault(); close() } }}>
        <img src={url} alt={overlay.name} draggable={false} onError={() => setFailed(true)}
          className="block max-h-[60dvh] max-w-full select-none" style={{ clipPath: drawing ? undefined : maskClipPath(preview ?? overlay.mask) }} />
        {editable && !failed && <svg className="absolute inset-0 size-full overflow-visible" style={{ cursor: dragCursor ? editCursor : (drawing || selectionBox ? 'crosshair' : undefined) }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            surface.current?.focus()
            if (!drawing && points.length) { startBox(event); return }
            if (drawing && draft.length < 1000) setDraft([...draft, position(event)])
            else setSelected([])
          }}>
          {points.map((p, index) => {
            const next = points[(index + 1) % points.length]
            if (drawing && index === points.length - 1) return null
            return <g key={`edge-${index}`}>
              <line x1={`${p.x * 100}%`} y1={`${p.y * 100}%`} x2={`${next.x * 100}%`} y2={`${next.y * 100}%`} stroke="#0284c7" strokeWidth="2" pointerEvents="none" />
              <line data-mask-edge={index} x1={`${p.x * 100}%`} y1={`${p.y * 100}%`} x2={`${next.x * 100}%`} y2={`${next.y * 100}%`} stroke="transparent" strokeWidth="16" style={{ cursor: editCursor }} onPointerDown={(event) => begin(event, [index, (index + 1) % points.length])} />
            </g>
          })}
          {points.map((p, index) => <g key={index}>
            <circle cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="5" fill={highlighted.includes(index) ? '#0284c7' : '#ffffff'} stroke="#0284c7" strokeWidth="2" pointerEvents="none" />
            <circle data-mask-vertex={index} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="11" fill="transparent" style={{ cursor: altHeld && !drawing ? removeCursor : editCursor }}
              onPointerDown={(event) => { if (drawing && index === 0 && event.button === 0) { event.stopPropagation(); close() } else begin(event, [index]) }} />
          </g>)}
          {selectionBox && <rect data-mask-selection="" x={`${Math.min(selectionBox.start.x, selectionBox.end.x) * 100}%`} y={`${Math.min(selectionBox.start.y, selectionBox.end.y) * 100}%`}
            width={`${Math.abs(selectionBox.end.x - selectionBox.start.x) * 100}%`} height={`${Math.abs(selectionBox.end.y - selectionBox.start.y) * 100}%`}
            fill="#0284c7" fillOpacity="0.12" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />}
        </svg>}
      </div>
    </div>
  </div>
}

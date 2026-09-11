import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { LocateFixed, Maximize, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DroneBrief } from '@/features/briefs/model/brief'
import { fitScene } from './scene-bounds'

export function MapControls({ brief }: { brief: DroneBrief }) {
  const map = useMap()
  const framedId = useRef<string | null>(null)
  const previousPosition = useRef(brief.coordinates)
  useEffect(() => {
    if (!map || framedId.current === brief.id) return
    const frame = () => {
      if (!map.getDiv().clientWidth || !map.getDiv().clientHeight) return
      fitScene(map, brief)
      framedId.current = brief.id
      observer.disconnect()
    }
    const observer = new ResizeObserver(frame)
    observer.observe(map.getDiv())
    frame()
    return () => observer.disconnect()
  }, [map, brief])
  useEffect(() => {
    const previous = previousPosition.current
    if (map && (previous.lat !== brief.coordinates.lat || previous.lng !== brief.coordinates.lng)) map.panTo(brief.coordinates)
    previousPosition.current = brief.coordinates
  }, [map, brief.coordinates])
  return <div className="absolute bottom-8 right-3 flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
    <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => map?.setZoom((map.getZoom() ?? 2) + 1)}><Plus /></Button>
    <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => map?.setZoom((map.getZoom() ?? 2) - 1)}><Minus /></Button>
    <Button variant="ghost" size="icon" aria-label="Frame scene" title="Frame scene" onClick={() => { if (map) fitScene(map, brief) }}><Maximize /></Button>
    <Button variant="ghost" size="icon" aria-label="Center on project" onClick={() => { map?.panTo(brief.coordinates); map?.setZoom(17) }}><LocateFixed /></Button>
  </div>
}

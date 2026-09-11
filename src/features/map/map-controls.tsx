import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { Maximize, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DroneBrief } from '@/features/briefs/model/brief'
import { fitScene } from './scene-bounds'
import type { MapNavigation } from './map-navigation'

export function MapControls({ brief, navigation, shadeActive = false }: { brief: DroneBrief; navigation?: MapNavigation | null; shadeActive?: boolean }) {
  const map = useMap()
  const activeMap = navigation === undefined ? map : navigation
  const framedId = useRef<string | null>(null)
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
  return <div className={`absolute right-3 z-20 flex gap-1 rounded-lg border bg-card p-1 shadow-sm ${shadeActive ? 'bottom-32 @min-[650px]:bottom-8' : 'bottom-8'}`}>
    <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={!activeMap} onClick={() => activeMap?.setZoom((activeMap.getZoom() ?? 2) + 1)}><Plus /></Button>
    <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={!activeMap} onClick={() => activeMap?.setZoom((activeMap.getZoom() ?? 2) - 1)}><Minus /></Button>
    <Button variant="ghost" size="icon" aria-label="Frame scene" title="Frame scene" disabled={!activeMap} onClick={() => { if (activeMap) fitScene(activeMap, brief) }}><Maximize /></Button>

  </div>
}

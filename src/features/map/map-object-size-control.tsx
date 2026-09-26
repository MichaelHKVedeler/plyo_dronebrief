import { Slider } from '@/components/ui/slider'
import { overlayDisplayPercent, overlayRenderingSize } from './map-object-scale'

export function MapObjectSizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const percent = overlayDisplayPercent(value)
  return <div className="grid min-w-0 gap-2 rounded-lg border bg-card p-2 shadow-sm @min-[550px]:p-3">
    <div className="flex flex-wrap justify-between gap-x-2 text-xs"><span>Overlay size</span><span className="tabular-nums">{percent}%</span></div>
    <Slider value={[percent]} min={0} max={100} step={5} onValueChange={([next]) => onChange(overlayRenderingSize(next))} thumbProps={{ 'aria-label': 'Overlay size', 'aria-valuetext': `${percent}%` }} />
  </div>
}

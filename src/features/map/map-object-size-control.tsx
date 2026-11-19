import { Slider } from '@/components/ui/slider'
import { overlayDisplayPercent, overlayRenderingSize } from './map-object-scale'
import { uprightSliderCard, uprightSliderClass } from './map-dimmer-control'

export function MapObjectSizeControl({ value, onChange, upright = false }: { value: number; onChange: (value: number) => void; upright?: boolean }) {
  const percent = overlayDisplayPercent(value)
  return <div className={upright ? uprightSliderCard : 'grid min-w-0 gap-2 rounded-lg border bg-card p-2 shadow-sm @min-[550px]:p-3'}>
    <div className={upright ? 'grid text-xs leading-tight' : 'flex flex-wrap justify-between gap-x-2 text-xs'}><span>{upright ? <>Icon<br />size</> : 'Icon size'}</span><span className="tabular-nums">{percent}%</span></div>
    <Slider orientation={upright ? 'vertical' : 'horizontal'} className={upright ? uprightSliderClass : undefined} value={[percent]} min={0} max={100} step={5} onValueChange={([next]) => onChange(overlayRenderingSize(next))} thumbProps={{ 'aria-label': 'Icon size', 'aria-valuetext': `${percent}%` }} />
  </div>
}

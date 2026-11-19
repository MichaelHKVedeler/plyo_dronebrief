import { Slider } from '@/components/ui/slider'

/** Public links stand the sliders upright inside the narrow layer menu. */
export const uprightSliderCard = 'grid w-10 justify-items-center gap-2 text-center'
export const uprightSliderClass = 'data-[orientation=vertical]:min-h-28'

export function MapDimmerControl({ value, onChange, upright = false }: { value: number; onChange: (value: number) => void; upright?: boolean }) {
  return <div className={upright ? uprightSliderCard : 'grid min-w-0 gap-2 rounded-lg border bg-card p-2 shadow-sm @min-[550px]:p-3'}>
    <div className={upright ? 'grid text-xs leading-tight' : 'flex flex-wrap justify-between gap-x-2 text-xs'}><span>{upright ? 'Dim' : 'Map dimming'}</span><span className="tabular-nums">{value}%</span></div>
    <Slider orientation={upright ? 'vertical' : 'horizontal'} className={upright ? uprightSliderClass : undefined} value={[value]} min={0} max={100} step={1} onValueChange={([next]) => onChange(next)} thumbProps={{ 'aria-label': 'Map dimming', 'aria-valuetext': `${value}%` }} />
  </div>
}

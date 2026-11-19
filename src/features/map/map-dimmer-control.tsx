import { Slider } from '@/components/ui/slider'

/** Public links stand the sliders upright inside the narrow layer menu. */
export const uprightSliderCard = 'flex min-h-0 w-10 flex-col items-center gap-2 text-center'
// The invisible after-area widens the narrow track's hit area from the screen edge to past the bar.
export const uprightSliderClass = 'data-[orientation=vertical]:h-28 data-[orientation=vertical]:min-h-8 shrink after:absolute after:-inset-y-2 after:-left-6 after:-right-12'

export function MapDimmerControl({ value, onChange, upright = false }: { value: number; onChange: (value: number) => void; upright?: boolean }) {
  return <div className={upright ? uprightSliderCard : 'grid min-w-0 gap-2 rounded-lg border bg-card p-2 shadow-sm @min-[550px]:p-3'}>
    <div className={upright ? 'grid shrink-0 text-xs leading-tight' : 'flex flex-wrap justify-between gap-x-2 text-xs'}><span>{upright ? 'Dim' : 'Map dimming'}</span><span className="tabular-nums">{value}%</span></div>
    <Slider orientation={upright ? 'vertical' : 'horizontal'} className={upright ? uprightSliderClass : undefined} value={[value]} min={0} max={100} step={1} onValueChange={([next]) => onChange(next)} thumbProps={{ 'aria-label': 'Map dimming', 'aria-valuetext': `${value}%` }} />
  </div>
}

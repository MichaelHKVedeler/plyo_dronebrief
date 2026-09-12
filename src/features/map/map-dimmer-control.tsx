import { Slider } from '@/components/ui/slider'

export function MapDimmerControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="absolute bottom-8 left-3 z-20 grid w-40 gap-2 rounded-lg border bg-card p-3 shadow-sm">
    <div className="flex justify-between gap-2 text-xs"><span>Map dimming</span><span className="tabular-nums">{value}%</span></div>
    <Slider value={[value]} min={0} max={100} step={1} onValueChange={([next]) => onChange(next)} thumbProps={{ 'aria-label': 'Map dimming', 'aria-valuetext': `${value}%` }} />
  </div>
}

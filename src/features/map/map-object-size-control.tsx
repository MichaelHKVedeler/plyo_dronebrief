import { Slider } from '@/components/ui/slider'

export function MapObjectSizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="grid min-w-0 gap-2 rounded-lg border bg-card p-2 shadow-sm @min-[550px]:p-3">
    <div className="flex flex-wrap justify-between gap-x-2 text-xs"><span>Overlay size</span><span className="tabular-nums">{value}%</span></div>
    <Slider value={[value]} min={25} max={300} step={5} onValueChange={([next]) => onChange(next)} thumbProps={{ 'aria-label': 'Overlay size', 'aria-valuetext': `${value}%` }} />
  </div>
}

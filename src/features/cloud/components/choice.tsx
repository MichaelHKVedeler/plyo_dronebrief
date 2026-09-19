import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function Choice({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="grid min-w-36 gap-1"><Label>{label}</Label><Select value={value || '__none__'} onValueChange={(next) => onChange(next === '__none__' ? '' : next)} disabled={disabled}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value || '__none__'} value={option.value || '__none__'}>{option.label}</SelectItem>)}</SelectContent></Select></div>
}

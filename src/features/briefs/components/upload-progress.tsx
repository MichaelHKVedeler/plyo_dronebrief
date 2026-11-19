import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UploadProgress({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return <div role="status" className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
    <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
    <span className="min-w-0 flex-1">{label}</span>
    {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>Cancel upload</Button>}
  </div>
}

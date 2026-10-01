import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type VisibilityControl = { visible: boolean; onToggle: () => void }

export function SettingsSection({ value, title, count, visibility, children }: { value: string; title: string; count?: number; visibility?: VisibilityControl; children: ReactNode }) {
  const visibilityAction = visibility?.visible ? `Hide ${title}` : `Show ${title}`
  return <AccordionItem value={value}>
    <div className="relative">
      <AccordionTrigger aria-label={title} className="items-center py-4 hover:no-underline">
        <span className="flex flex-1 items-center justify-between gap-2">{title}{count !== undefined && <Badge variant="secondary" aria-hidden="true">{count}</Badge>}</span>
      </AccordionTrigger>
      {visibility && <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
        <span aria-hidden="true" className="invisible whitespace-nowrap text-sm font-medium">{title}</span>
        <Button type="button" variant="ghost" size="icon-sm" className="pointer-events-auto ml-2"
          aria-pressed={visibility.visible} aria-label={visibilityAction} title={visibilityAction} onClick={visibility.onToggle}>
          {visibility.visible ? <Eye /> : <EyeOff />}
        </Button>
      </div>}
    </div>
    <AccordionContent><div className="grid gap-4 px-1 pt-1">{children}</div></AccordionContent>
  </AccordionItem>
}

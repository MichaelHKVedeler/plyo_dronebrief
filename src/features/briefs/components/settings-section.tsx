import type { ReactNode } from 'react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

export function SettingsSection({ value, title, count, children }: { value: string; title: string; count?: number; children: ReactNode }) {
  return <AccordionItem value={value}>
    <AccordionTrigger aria-label={title} className="items-center py-4 hover:no-underline">
      <span className="flex flex-1 items-center justify-between gap-2">{title}{count !== undefined && <Badge variant="secondary" aria-hidden="true">{count}</Badge>}</span>
    </AccordionTrigger>
    <AccordionContent><div className="grid gap-4 px-1 pt-1">{children}</div></AccordionContent>
  </AccordionItem>
}

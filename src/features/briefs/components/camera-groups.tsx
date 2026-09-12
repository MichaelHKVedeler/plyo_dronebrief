import { useState, type ReactNode } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cameraLabels, cameraTypes, type CameraAngle } from '../model/brief'
import { cameraAppearance } from './camera-appearance'

type Props = {
  angles: CameraAngle[]
  selectedId?: string | null
  onRemoveCameras?: (ids: string[]) => void
  children: (angles: CameraAngle[]) => ReactNode
}

export function CameraGroups({ angles, selectedId, onRemoveCameras, children }: Props) {
  const [open, setOpen] = useState<string[]>([...cameraTypes])
  const [lastSelected, setLastSelected] = useState(selectedId)
  const [deleting, setDeleting] = useState<CameraAngle['type'] | null>(null)
  if (lastSelected !== selectedId) {
    setLastSelected(selectedId)
    const selected = angles.find((angle) => angle.id === selectedId)
    if (selected && !open.includes(selected.type)) setOpen([...open, selected.type])
  }
  return <Accordion type="multiple" value={open} onValueChange={(value) => { setOpen(value); setDeleting(null) }}>
    {cameraTypes.map((type) => {
      const points = angles.filter((angle) => angle.type === type)
      if (!points.length) return null
      const Icon = cameraAppearance[type].Icon
      const label = cameraLabels[type]
      return <AccordionItem key={type} value={type}>
        <div className="flex items-center gap-1 [&>h3]:min-w-0 [&>h3]:flex-1">
          <AccordionTrigger aria-label={label + ' points'} className="min-w-0 flex-1 items-center py-3 hover:no-underline">
            <span className="flex min-w-0 items-center gap-2"><Icon className="size-4 shrink-0" /><span>{label}</span><Badge variant="secondary">{points.length}</Badge></span>
          </AccordionTrigger>
          {onRemoveCameras && (deleting === type ? <div className="flex shrink-0 items-center" onKeyDown={(event) => {
            if (event.key === 'Escape') { event.stopPropagation(); setDeleting(null) }
          }}>
            <span className="text-xs text-destructive">Delete?</span>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label={'Confirm delete all ' + label + ' points'} onClick={() => {
              onRemoveCameras(points.map((angle) => angle.id)); setDeleting(null)
            }}><Check /></Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label={'Cancel deleting ' + label + ' points'} onClick={() => setDeleting(null)}><X /></Button>
          </div> : <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" aria-label={'Delete all ' + label + ' points'} onClick={() => setDeleting(type)}><Trash2 /></Button>)}
        </div>
        <AccordionContent><div className="ml-2 grid gap-3 border-l pl-2 pt-1">{children(points)}</div></AccordionContent>
      </AccordionItem>
    })}
  </Accordion>
}

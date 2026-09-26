import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { numberedCameras } from '../model/camera-numbers'
import { cameraLabels, effectivePanoramaHeights, formatHeightsMeters, type DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { briefingCopy } from './briefing-copy'

export function PointHeightsCallout({ brief, angleId, language, onClose }: {
  brief: DroneBrief
  angleId: string
  language: PdfLanguage
  onClose: () => void
}) {
  const point = numberedCameras(brief.angles).find((item) => item.angle.id === angleId)
  if (!point) return null
  const copy = briefingCopy[language]
  const { angle, number } = point
  const name = `${cameraLabels[angle.type]} ${number}`
  const meters = angle.type === 'drone-image'
    ? brief.typeSettings['drone-image'].heightsMeters
    : angle.type === '360'
      ? effectivePanoramaHeights(brief.typeSettings['360'].heightsMeters, angle)
      : null
  const heights = meters ? (formatHeightsMeters(meters).replaceAll(', ', ' m, ') + (meters.length ? ' m' : '')) : copy.ground
  return <div role="status" aria-label={`${name} ${copy.heights}`} className="pointer-events-auto relative grid w-max max-w-56 gap-0.5 rounded-lg border bg-card px-2.5 py-1.5 text-sm shadow-md">
    <span aria-hidden="true" className="absolute -bottom-1 left-2.5 size-2 rotate-45 border-b border-l bg-card" />
    <div className="flex items-center justify-between gap-2">
      <p className="font-medium">{copy.heights}</p>
      <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={copy.closeHeights} onClick={onClose}><X /></Button>
    </div>
    <p className="text-muted-foreground">{meters?.length === 0 ? copy.noHeights : heights}{angle.type === '360' && angle.heightsMeters?.length ? ` · ${copy.customHeights}` : ''}</p>
  </div>
}

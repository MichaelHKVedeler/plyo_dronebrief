import type { ReactNode } from 'react'
import type { DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { toggleIsolatedCapture, type IsolatedCapture } from '@/features/map/isolated-capture'
import { captureInstructions } from './capture-instructions'
import { CaptureKindIsolateButton } from './capture-kind-glyph'

export function BriefingMapLayers({ brief, language, isolatedKind, onIsolate, infoAction }: {
  brief: DroneBrief
  language: PdfLanguage
  isolatedKind: IsolatedCapture
  onIsolate: (kind: IsolatedCapture) => void
  infoAction?: ReactNode
}) {
  const rows = captureInstructions(brief, language)
  if (!rows.length && !infoAction) return null
  return <div className={'pointer-events-auto grid w-fit justify-items-center gap-1 rounded-lg border bg-card p-2 shadow-sm' + (rows.length ? '' : ' lg:hidden')}>
    {infoAction}
    {rows.map((row) => <CaptureKindIsolateButton key={row.key} kind={row.key} label={row.label} pressed={isolatedKind === row.key}
      onClick={() => onIsolate(toggleIsolatedCapture(isolatedKind, row.key))} />)}
  </div>
}

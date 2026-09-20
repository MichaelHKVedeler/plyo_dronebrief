import type { DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { captureInstructions } from './capture-instructions'
import { CaptureKindIsolateButton, type CaptureKind } from './capture-kind-glyph'

export function CaptureInstructionsList({ brief, language, isolatedKind, onIsolate }: {
  brief: DroneBrief
  language: PdfLanguage
  isolatedKind: CaptureKind | null
  onIsolate: (kind: CaptureKind | null) => void
}) {
  const rows = captureInstructions(brief, language)
  if (!rows.length) return null
  return <ul className="grid gap-4" aria-label="Capture instructions">
    {rows.map((row) => <li key={row.key} className={`flex items-start justify-between gap-3 ${isolatedKind && isolatedKind !== row.key ? 'opacity-50' : ''}`}>
      <div className="flex min-w-0 items-start gap-2">
        <CaptureKindIsolateButton kind={row.key} label={row.label} pressed={isolatedKind === row.key}
          onClick={() => onIsolate(isolatedKind === row.key ? null : row.key)} />
        <div className="min-w-0">
          <p className="font-medium">{row.label} <span className="font-normal text-muted-foreground">| {row.rule}</span></p>
          <p className="text-muted-foreground text-sm">{row.detail}</p>
        </div>
      </div>
      <p className="font-medium tabular-nums" aria-label={row.label + ' count'}>{row.images}</p>
    </li>)}
  </ul>
}

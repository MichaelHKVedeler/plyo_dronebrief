import type { DroneBrief } from '../model/brief'
import type { PdfLanguage } from '../export/pdf-copy'
import { captureInstructions } from './capture-instructions'
import { CaptureKindGlyph, type CaptureKind } from './capture-kind-glyph'

export function CaptureInstructionsList({ brief, language, hiddenKinds }: {
  brief: DroneBrief
  language: PdfLanguage
  hiddenKinds: ReadonlySet<CaptureKind>
}) {
  const rows = captureInstructions(brief, language)
  if (!rows.length) return null
  return <ul className="grid gap-4" aria-label="Capture instructions">
    {rows.map((row) => {
      const dimmed = hiddenKinds.has(row.key)
      return <li key={row.key} className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CaptureKindGlyph kind={row.key} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${dimmed ? 'lg:opacity-50' : ''}`}>{row.label} {row.rule && <span className="font-normal text-muted-foreground">| {row.rule}</span>}</p>
          </div>
        </div>
        {(row.range || row.heights) && <div className={`shrink-0 text-right text-sm font-medium ${dimmed ? 'lg:opacity-50' : ''}`}>
          {row.range && <p className="whitespace-nowrap">{row.range}:</p>}
          {row.heights && <p className="whitespace-nowrap">{row.heights}</p>}
        </div>}
      </li>
    })}
  </ul>
}

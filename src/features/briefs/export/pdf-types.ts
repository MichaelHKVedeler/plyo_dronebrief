import type { DroneBrief, ShootSlot } from '../model/brief'
import type { PdfLanguage } from './pdf-copy'

export type PdfMapImage = { kind: 'map' | 'floor-plan'; dataUrl: string; shadowSlot?: ShootSlot }
export type PdfMapCapture = (signal: AbortSignal) => Promise<PdfMapImage[]>
export type PdfReference = { caption: string; dataUrl: string }
export type PdfAssets = { regular: Uint8Array; bold: Uint8Array; background: Uint8Array; logo: Uint8Array }
export type PdfExportInput = {
  brief: DroneBrief
  language: PdfLanguage
  coverAddress: string
  includeProjectName?: boolean
  includeClientName?: boolean
  notes: { description: string; instructions: string }
  maps: PdfMapImage[]
  diagram: boolean
  references: PdfReference[]
}

// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createBrief } from '../model/brief'
import { createBriefPdf } from './create-brief-pdf'
import { pdfFilename } from './pdf-copy'
import { wrapPdfText } from './pdf-layout'
import type { PdfAssets, PdfExportInput } from './pdf-types'

const file = (name: string) => new Uint8Array(readFileSync(resolve('public/pdf', name)))
const assets: PdfAssets = { regular: file('NotoSans-Regular.ttf'), bold: file('NotoSans-Bold.ttf'), background: file('template-background.jpg'), logo: file('plyo-logo.png') }
function input(): PdfExportInput {
  const brief = createBrief({ name: 'Bjørvika øst', clientName: 'Müller & Søn', date: '2026-09-19', times: ['09:00'] })
  brief.angles = [{ id: 'a', label: 'Panorama', type: '360', position: brief.coordinates, focus: { directionDegrees: 45, fovDegrees: 90 } }]
  return { brief, coverAddress: 'Dronning Eufemias gate: Bjørvika', language: 'en', notes: { description: 'South-facing property.', instructions: 'Use the east gate.' }, diagram: true, maps: [], references: [] }
}
describe('PDF export', () => {
  it.each(['en', 'nb'] as const)('builds a valid landscape %s brief without changing source data', async (language) => {
    const source = { ...input(), language }
    const before = structuredClone(source)
    const bytes = await createBriefPdf(source, assets)
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(7)
    expect(result.getTitle()).toContain(language === 'en' ? 'Photo Brief' : 'Fotobrief')
    result.getPages().forEach((page) => expect(page.getSize()).toEqual({ width: 720, height: 405 }))
    expect(source).toEqual(before)
  })
  it('paginates long notes and point lists and includes reference/map pages', async () => {
    const source = input()
    source.notes.description = ('Property with a long description.\n').repeat(60).slice(0, 2000)
    source.notes.instructions = 'A'.repeat(2000)
    source.brief.angles = Array.from({ length: 21 }, (_, i) => ({ ...source.brief.angles[0], id: String(i) }))
    const png = 'data:image/png;base64,' + Buffer.from(assets.logo).toString('base64')
    source.maps = [{ kind: 'floor-plan', dataUrl: png }, { kind: 'map', dataUrl: png }]
    source.references = [{ dataUrl: png, caption: 'View from the east' }]
    source.diagram = false
    const result = await PDFDocument.load(await createBriefPdf(source, assets))
    expect(result.getPageCount()).toBeGreaterThan(12)
  })
  it('exports an empty brief with omitted notes and catches unsupported text', async () => {
    const source = input(); source.brief.angles = []; source.notes = { description: '', instructions: '' }
    expect((await PDFDocument.load(await createBriefPdf(source, assets))).getPageCount()).toBe(7)
    source.notes.instructions = 'Drone 🚁'
    await expect(createBriefPdf(source, assets)).rejects.toThrow('does not support')
  })
  it('wraps very long words and preserves blank paragraphs inside page margins', async () => {
    const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica)
    const lines = wrapPdfText('LongWord'.repeat(80) + '\n\nSecond paragraph', font, 12, 200)
    expect(lines).toContain('')
    expect(lines.every((line) => font.widthOfTextAtSize(line, 12) <= 200)).toBe(true)
  })
  it('fits forty positions per page and adds a continuation only when needed', async () => {
    const source = input()
    source.brief.angles = Array.from({ length: 40 }, (_, i) => ({ ...source.brief.angles[0], id: String(i) }))
    expect((await PDFDocument.load(await createBriefPdf(source, assets))).getPageCount()).toBe(7)
    source.brief.angles.push({ ...source.brief.angles[0], id: 'extra' })
    expect((await PDFDocument.load(await createBriefPdf(source, assets))).getPageCount()).toBe(8)
  })
  it('creates safe filenames without losing Norwegian letters', () => {
    expect(pdfFilename('Bjørvika: øst/vest?', 'nb')).toBe('Bjørvika- øst-vest-_Fotobrief_Plyo.pdf')
    expect(pdfFilename('... ', 'en')).toBe('Project_Photobrief_Plyo.pdf')
  })
  it('omits hidden names from font validation and document title', async () => {
    const source = input()
    source.brief.project.name = 'Private 🚁'; source.brief.project.clientName = 'Hidden 🚁'
    source.includeProjectName = false; source.includeClientName = false
    const doc = await PDFDocument.load(await createBriefPdf(source, assets))
    expect(doc.getTitle()).toBe('Dronning Eufemias gate: Bjørvika - Photo Brief')
    source.includeClientName = true
    await expect(createBriefPdf(source, assets)).rejects.toThrow('does not support')
  })
})

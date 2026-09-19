import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatShootTime, shootSlots } from '../model/brief'
import { countBriefImages } from '../model/image-count'
import { pdfCopy, pdfDate } from './pdf-copy'
import { fitPdfText, wrapPdfText } from './pdf-layout'
import type { PdfAssets, PdfExportInput } from './pdf-types'
import { drawPdfPointDiagram } from '@/features/map/pdf-point-diagram'
import { pdfCapturePoints, pdfProjectPosition, pdfProjectSize } from './pdf-project'
import { sunlightRange, usedSunlightDays } from '@/features/map/sunlight-times'

const width = 720, height = 405
const ink = rgb(.04, .05, .06), muted = rgb(.35, .39, .40), teal = rgb(0, .65, .51)

export async function createBriefPdf(input: PdfExportInput, assets: PdfAssets): Promise<Uint8Array> {
  const { brief, notes, language, maps, references } = input
  const c = pdfCopy[language]
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const [regular, bold, background, logo] = await Promise.all([
    doc.embedFont(assets.regular, { subset: true }), doc.embedFont(assets.bold, { subset: true }),
    doc.embedJpg(assets.background), doc.embedPng(assets.logo),
  ])
  const projectName = input.includeProjectName === false ? '' : brief.project.name
  const clientName = input.includeClientName === false ? '' : brief.project.clientName
  doc.setTitle(`${projectName || input.coverAddress || c.addressNotSet} - ${c.title}`)
  doc.setAuthor('Plyo'); doc.setCreator('Dronebrief'); doc.setLanguage(language === 'nb' ? 'nb-NO' : 'en-GB')
  // Fonts cover Norwegian/European text. Report unsupported characters rather
  // than silently replacing content with missing-glyph boxes.
  const supported = new Set(regular.getCharacterSet())
  for (const value of [input.coverAddress, projectName, clientName, notes.description, notes.instructions, ...references.map((r) => r.caption)]) {
    const unsupported = [...value].find((char) => !/\s/.test(char) && !supported.has(char.codePointAt(0)!))
    if (unsupported) throw new Error(`The PDF font does not support “${unsupported}”. Remove or replace it in the export text and try again.`)
  }
  const text = (page: PDFPage, value: string, x: number, y: number, size = 11, font: PDFFont = regular, color = ink) => {
    if (value) page.drawText(value, { x, y, size, font, color })
  }
  const center = (page: PDFPage, value: string, y: number, size = 12, font = regular, color = ink) => text(page, value, (width - font.widthOfTextAtSize(value, size)) / 2, y, size, font, color)
  const paragraph = (page: PDFPage, value: string, x: number, y: number, maxWidth: number, size = 11, font = regular, color = ink) => {
    const lines = wrapPdfText(value, font, size, maxWidth)
    lines.forEach((line, i) => text(page, line, x, y - i * size * 1.5, size, font, color))
    return y - lines.length * size * 1.5
  }
  const addPage = (title?: string, smallLogo = true) => {
    const page = doc.addPage([width, height])
    page.drawImage(background, { x: 0, y: 0, width, height })
    if (smallLogo) page.drawImage(logo, { x: 28, y: 371, width: 48, height: 14 })
    if (title) center(page, title, 346, 19, bold, teal)
    return page
  }
  const cover = addPage(undefined, false)
  cover.drawImage(logo, { x: 36, y: 352, width: 90, height: 26 })
  cover.drawRectangle({ x: 145, y: 360, width: 5, height: 5, color: teal })
  const addressTitle = fitPdfText(input.coverAddress.trim() || c.addressNotSet, regular, 22, 515, 3, 12)
  addressTitle.lines.forEach((line, i) => text(cover, line, 169, 360 - i * addressTitle.size * 1.3, addressTitle.size))
  let coverY = 360 - addressTitle.lines.length * addressTitle.size * 1.3 - 18
  if (projectName) {
    const projectTitle = fitPdfText(projectName, bold, 16, 515, 3, 11)
    projectTitle.lines.forEach((line, i) => text(cover, line, 169, coverY - i * projectTitle.size * 1.3, projectTitle.size, bold))
    coverY -= projectTitle.lines.length * projectTitle.size * 1.3 + 12
  }
  if (clientName) paragraph(cover, `${c.client}: ${clientName}`, 169, coverY, 490, 11, regular, muted)
  text(cover, c.title, 36, 94, 26)
  cover.drawLine({ start: { x: 36, y: 80 }, end: { x: 66, y: 80 }, thickness: 2, color: teal })
  text(cover, pdfDate(brief.project.date, language), 36, 58, 11, regular, muted)

  const schedule = addPage(c.schedule)
  const slots = shootSlots(brief.project)
  const sunDays = usedSunlightDays(slots, pdfProjectPosition(brief))
  sunDays.forEach((day, i) => {
    const top = sunDays.length === 1 ? 280 : 308 - i * 82
    center(schedule, `${c.sunCalculated} ${pdfDate(day.date, language)} · ${c.sunMethod}: ${day.zone}`, top, 10, regular, muted)
    day.usedPhases.forEach((phase, column) => {
      const x = (width - day.usedPhases.length * 164) / 2 + column * 164 + 9
      text(schedule, c[phase], x, top - 29, 14, bold, teal)
      const value = sunlightRange(day.phases[phase], day.date, day.zone) ?? c.noSunWindow
      text(schedule, value, x, top - 49, value.length > 20 ? 9 : 12)
      schedule.drawLine({ start: { x, y: top - 56 }, end: { x: x + 146, y: top - 56 }, thickness: 1, color: teal })
    })
    if (!day.usedPhases.length) center(schedule, c.noSunMatch, top - 40, 11, regular, muted)
    const planned = slots.filter((slot) => slot.date === day.date).map(formatShootTime).join(', ')
    center(schedule, `${c.plannedShoots}: ${planned}${day.condition === 'normal' ? '' : ` · ${c[day.condition]}`}`, top - 72, 9, regular, muted)
  })
  paragraph(schedule, c.scheduleNote, 66, sunDays.length === 1 ? 144 : 54, 588, 9, regular, muted)
  paragraph(schedule, c.sunDefinitions, 66, sunDays.length === 1 ? 105 : 32, 588, 8, regular, muted)

  const counts = countBriefImages(brief)
  const byType = { drone: brief.angles.filter((a) => a.type === 'drone-image').length, panorama: brief.angles.filter((a) => a.type === '360').length, dslr: brief.angles.filter((a) => a.type === 'dslr').length }
  const heights = (list: number[]) => list.length ? list.map((h) => `${h} m`).join(', ') : c.notSet
  const pointsLabel = (count: number) => `${count} ${count === 1 ? c.point.toLowerCase() : c.points}`
  const captureRows = [
    ...(brief.circleRig ? [{ name: c.rig, count: counts.circleRig, detail: `${brief.circleRig.arrowCount} ${c.arrows} · ${c.heights}: ${heights(brief.typeSettings['drone-image'].heightsMeters)}`, rule: c.rigRule }] : []),
    ...(byType.drone ? [{ name: c.drone, count: counts.droneImage, detail: `${pointsLabel(byType.drone)} · ${c.heights}: ${heights(brief.typeSettings['drone-image'].heightsMeters)}`, rule: c.droneRule }] : []),
    ...(byType.panorama ? [{ name: c.panorama, count: counts.panorama, detail: `${pointsLabel(byType.panorama)} · ${c.heights}: ${heights(brief.typeSettings['360'].heightsMeters)}`, rule: `${c.individual}. ${c.panoramaRule}.` }] : []),
    ...(byType.dslr ? [{ name: c.dslr, count: counts.dslr, detail: `${pointsLabel(byType.dslr)} · ${brief.typeSettings.dslr.angleCount} ${c.arrows} · ${brief.typeSettings.dslr.spacingDegrees}°`, rule: `${c.ground}. ${c.dslrRule}.` }] : []),
  ]
  const sizeTitle = c.projectSizes[pdfProjectSize(brief)]
  let capturePage = addPage(sizeTitle), y = 310
  if (!captureRows.length) paragraph(capturePage, c.none, 70, y, 580, 14)
  for (const row of captureRows) {
    const detailLines = wrapPdfText(row.detail, regular, 11, 500)
    const ruleLines = wrapPdfText(row.rule, regular, 10, 520)
    const rowHeight = 25 + detailLines.length * 16 + ruleLines.length * 14
    if (y - rowHeight < 55) { capturePage = addPage(`${sizeTitle} (${c.continued})`); y = 310 }
    capturePage.drawCircle({ x: 61, y: y - 4, size: 8, color: teal })
    text(capturePage, row.name, 83, y, 16, bold)
    text(capturePage, `${row.count} ${c.photos}`, 554, y, 12, bold, teal)
    let rowY = paragraph(capturePage, row.detail, 83, y - 21, 500, 11)
    rowY = paragraph(capturePage, row.rule, 83, rowY - 2, 520, 10, regular, muted)
    y = rowY - 10
  }
  center(capturePage, `${c.total}: ${counts.total}  ·  ${counts.times} ${counts.times === 1 ? c.time : c.times}`, 45, 11, bold, teal)

  // Forty positions per page, including the actual rig arrows and rig center.
  const points = pdfCapturePoints(brief)
  for (let offset = 0; offset < Math.max(points.length, 1); offset += 40) {
    const page = addPage(offset ? `${c.captureList} (${c.continued})` : c.captureList)
    if (!points.length) paragraph(page, c.none, 36, 285, 648, 12, regular, muted)
    const chunk = points.slice(offset, offset + 40)
    const columns = chunk.length > 12 ? 2 : 1
    const rowsPerColumn = Math.ceil(chunk.length / columns)
    for (let col = 0; col < columns && chunk.length; col++) {
      const x = 34 + col * 338
      text(page, c.point, x, 310, 8, bold, teal)
      text(page, c.coordinates, x + 40, 310, 8, bold, teal)
      text(page, c.headingFov, x + 211, 310, 8, bold, teal)
      page.drawLine({ start: { x, y: 303 }, end: { x: x + 306, y: 303 }, thickness: .6, color: teal })
      chunk.slice(col * rowsPerColumn, (col + 1) * rowsPerColumn).forEach((point, i) => {
        const rowY = 289 - i * 12
        if (i % 2 === 0) page.drawRectangle({ x: x - 3, y: rowY - 3, width: 313, height: 12, color: rgb(.94, .97, .96) })
        text(page, point.label, x, rowY, 8, bold)
        text(page, `${point.position.lat.toFixed(6)}, ${point.position.lng.toFixed(6)}`, x + 40, rowY, 8)
        const aim = point.direction === undefined ? '-' : `${point.direction.toFixed(1)}°${point.fov === undefined ? '' : ` / ${point.fov.toFixed(1)}°`}`
        text(page, aim, x + 211, rowY, 8)
      })
    }
    text(page, c.pointLegend, 34, 33, 8, regular, muted)
  }

  let info = addPage(c.information), infoY = 298
  for (const [label, value] of [[c.property, notes.description], [c.instructions, notes.instructions]]) {
    if (!value.trim()) continue
    const lines = wrapPdfText(value, regular, 12, 568)
    let first = true
    while (lines.length) {
      if (infoY < 120) { info = addPage(`${c.information} (${c.continued})`); infoY = 298 }
      text(info, first ? label : `${label} (${c.continued})`, 76, infoY, 14, bold, teal)
      infoY -= 24
      const chunk = lines.splice(0, Math.max(1, Math.floor((infoY - 82) / 18)))
      chunk.forEach((line) => { text(info, line, 76, infoY, 12); infoY -= 18 })
      infoY -= 25; first = false
    }
  }
  if (!notes.description.trim() && !notes.instructions.trim()) paragraph(info, c.emptyNotes, 76, infoY, 568, 12, regular, muted)
  text(info, `${c.total}: ${counts.total}`, 76, 52, 16, bold, teal)

  for (const map of maps) {
    const page = addPage(map.kind === 'floor-plan' ? c.mapPlan : c.map)
    const image = await doc.embedPng(map.dataUrl)
    const fit = image.scaleToFit(672, 290)
    page.drawImage(image, { x: (width - fit.width) / 2, y: 45 + (290 - fit.height) / 2, width: fit.width, height: fit.height })
    const shadowCaption = map.shadowSlot ? `  ShadeMap: ${pdfDate(map.shadowSlot.date, language)} ${map.shadowSlot.time}` : ''
    text(page, c.mapNote + shadowCaption, 28, 31, 8, regular, muted)
  }
  if (input.diagram) {
    const page = addPage(c.diagram)
    drawPdfPointDiagram(page, brief, regular)
    text(page, c.diagramNote, 32, 44, 9, regular, muted)
    text(page, `D: ${c.drone}   P: 360°   S: DSLR   R: ${c.rig}`, 32, 30, 8, regular, muted)
  }
  for (const ref of references) {
    const page = addPage(c.reference)
    const image = ref.dataUrl.startsWith('data:image/png') ? await doc.embedPng(ref.dataUrl) : await doc.embedJpg(ref.dataUrl)
    const fit = image.scaleToFit(640, 250)
    page.drawImage(image, { x: (width - fit.width) / 2, y: 82 + (250 - fit.height) / 2, width: fit.width, height: fit.height })
    paragraph(page, ref.caption, 40, 64, 640, 10, regular, muted)
  }
  const delivery = addPage()
  delivery.drawRectangle({ x: 26, y: 34, width: 668, height: 330, borderColor: muted, borderWidth: .5 })
  center(delivery, c.positions, 254, 13, bold)
  const positionLines = wrapPdfText(c.positionsNote, regular, 12, 590)
  positionLines.forEach((line, i) => center(delivery, line, 232 - i * 18, 12))
  center(delivery, c.delivery, 180, 13, bold)
  center(delivery, c.files, 160, 12)
  center(delivery, c.folders, 142, 12)
  doc.getPages().forEach((page, i, pages) => text(page, `${i + 1} / ${pages.length}`, 656, 15, 8, regular, muted))
  return doc.save()
}

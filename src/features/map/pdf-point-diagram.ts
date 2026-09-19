import { rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { DroneBrief, Position } from '@/features/briefs/model/brief'
import { numberedCameras } from '@/features/briefs/model/camera-numbers'
import { rigOutline, rigArrows } from './geometry'
import { sceneBounds, scenePoints } from './scene-bounds'
import { cameraDirectionLayout } from './camera-directions'

// An explicit offline alternative, never presented as a basemap screenshot.
export function drawPdfPointDiagram(page: PDFPage, brief: DroneBrief, font: PDFFont) {
  const bounds = sceneBounds(scenePoints(brief))
  const west = bounds.west, east = bounds.east < west ? bounds.east + 360 : bounds.east
  const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)) * 180 / Math.PI
  const south = mercatorY(bounds.south), north = mercatorY(bounds.north)
  const scale = Math.min(592 / Math.max(east - west, 0.00001), 218 / Math.max(north - south, 0.00001))
  const project = (p: Position) => ({ x: 360 + ((p.lng < west ? p.lng + 360 : p.lng) - (west + east) / 2) * scale, y: 198 + (mercatorY(p.lat) - (south + north) / 2) * scale })
  const teal = rgb(0, .65, .51), orange = rgb(.76, .25, .05), purple = rgb(.49, .13, .81), blue = rgb(.01, .41, .63)
  page.drawRectangle({ x: 32, y: 62, width: 656, height: 272, color: rgb(.96, .98, .98) })
  for (let x = 52; x < 685; x += 32) page.drawLine({ start: { x, y: 62 }, end: { x, y: 334 }, color: rgb(.89, .93, .93), thickness: .5 })
  const line = (points: Position[], color = teal) => points.forEach((p, i) => page.drawLine({ start: project(p), end: project(points[(i + 1) % points.length]), color, thickness: 1 }))
  const arrow = (p: { x: number; y: number }, bearing: number, color = teal) => {
    const a = bearing * Math.PI / 180, end = { x: p.x + Math.sin(a) * 16, y: p.y + Math.cos(a) * 16 }
    page.drawLine({ start: p, end, color, thickness: 1.2 })
    for (const side of [-.5, .5]) page.drawLine({ start: end, end: { x: end.x - Math.sin(a + side) * 5, y: end.y - Math.cos(a + side) * 5 }, color, thickness: 1.2 })
  }
  const dot = (point: Position, label: string, color = teal) => {
    const p = project(point)
    page.drawCircle({ x: p.x, y: p.y, size: 8, color, borderColor: rgb(1, 1, 1), borderWidth: 1 })
    page.drawText(label, { x: p.x - font.widthOfTextAtSize(label, 7) / 2, y: p.y - 2.5, size: 7, font, color: rgb(1, 1, 1) })
    return p
  }
  brief.polygons.forEach((polygon) => line(polygon.vertices, orange))
  if (brief.circleRig) {
    line(rigOutline(brief.circleRig))
    rigArrows(brief.circleRig).forEach((a) => { const p = dot(a.position, 'R' + a.number); arrow(p, a.directionDegrees) })
  }
  for (const { angle, number } of numberedCameras(brief.angles)) {
    const color = angle.type === '360' ? purple : angle.type === 'dslr' ? blue : orange
    const p = project(angle.position)
    if (angle.type === '360' && angle.focus) {
      const { directionDegrees: heading, fovDegrees: width } = angle.focus
      const arc = Array.from({ length: 25 }, (_, i) => {
        const a = (heading - width / 2 + width * i / 24) * Math.PI / 180
        return { x: p.x + Math.sin(a) * 25, y: p.y + Math.cos(a) * 25 }
      })
      const points = [p, ...arc, p]
      page.drawSvgPath(points.map((q, i) => `${i ? 'L' : 'M'} ${q.x} ${-q.y}`).join(' ') + ' Z', { color, opacity: .15, borderColor: color, borderWidth: .7 })
    } else if (angle.type !== '360') {
      cameraDirectionLayout(angle.type === 'dslr' ? brief.typeSettings.dslr : undefined).offsets.forEach((offset) => arrow(p, angle.directionDegrees + offset, color))
    }
    dot(angle.position, (angle.type === '360' ? 'P' : angle.type === 'dslr' ? 'S' : 'D') + number, color)
  }
  page.drawText('N', { x: 663, y: 311, font, size: 9, color: teal })
  arrow({ x: 667, y: 290 }, 0)
}

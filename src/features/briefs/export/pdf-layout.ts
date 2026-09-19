import type { PDFFont } from 'pdf-lib'

// Split long tokens as well as paragraphs so addresses/URLs cannot leave a page.
export function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    let line = ''
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue }
      if (line) { lines.push(line); line = '' }
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = '' }
        line += char
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

export function fitPdfText(text: string, font: PDFFont, initial: number, width: number, maxLines: number, min = 14) {
  let size = initial
  while (size > min && wrapPdfText(text, font, size, width).length > maxLines) size -= 1
  return { size, lines: wrapPdfText(text, font, size, width) }
}

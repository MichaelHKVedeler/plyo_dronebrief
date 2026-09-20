import type { PdfAssets, PdfReference } from './pdf-types'
import { readLocalImage } from '../storage/local-images'

export async function loadPdfAssets(signal: AbortSignal): Promise<PdfAssets> {
  const files = ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'template-background.jpg', 'plyo-logo.png']
  const [regular, bold, background, logo] = await Promise.all(files.map(async (file) => {
    const response = await fetch(import.meta.env.BASE_URL + 'pdf/' + file, { signal })
    if (!response.ok) throw new Error('PDF design assets could not load. Reload the app and try again.')
    return new Uint8Array(await response.arrayBuffer())
  }))
  return { regular, bold, background, logo }
}

export async function pdfReferenceFromUrl(url: string, caption: string): Promise<PdfReference> {
  const image = new Image(); image.src = url; await image.decode()
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Reference image could not be prepared.')
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Reference image could not be prepared.')
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { caption, dataUrl: canvas.toDataURL('image/jpeg', .92) }
}

export async function pdfReference(file: File, caption: string): Promise<PdfReference> {
  const local = await readLocalImage(file)
  try { return await pdfReferenceFromUrl(local.url, caption) }
  finally { URL.revokeObjectURL(local.url) }
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
}

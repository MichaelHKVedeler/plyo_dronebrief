/** Longest side of the rendered page. Large enough for a readable floorplan, small enough to upload. */
const maxSidePixels = 4096
const maxPdfBytes = 50 * 1024 * 1024

export function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** Renders the first page of a PDF to a JPG file in the browser. pdf.js is loaded only when needed. */
export async function pdfToJpeg(file: File): Promise<File> {
  if (file.size > maxPdfBytes) throw new Error('Choose a PDF smaller than 50 MB.')
  const [pdfjs, { default: workerUrl }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let pdf
  try { pdf = await loading.promise }
  catch { void loading.destroy(); throw new Error('This PDF could not be opened.') }
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxSidePixels / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    // White background: PDF pages are transparent and JPG has no alpha.
    await page.render({ canvas, viewport, background: '#ffffff' }).promise
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('The PDF page could not be converted to an image.')
    return new File([blob], file.name.replace(/\.pdf$/i, '') + '.jpg', { type: 'image/jpeg' })
  } finally { void loading.destroy() }
}

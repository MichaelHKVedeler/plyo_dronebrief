import sharp from 'sharp'

export const floorplanLimits = { inputBytes: 30 * 1024 * 1024, inputPixels: 100_000_000, outputPixels: 8_000_000, targetBytes: 2 * 1024 * 1024, maxBytes: 4 * 1024 * 1024, version: 1 } as const
export function fitFloorplan(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / width, edge / height, Math.sqrt(floorplanLimits.outputPixels / (width * height)))
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) }
}
export async function optimizeFloorplan(input: Buffer) {
  if (!input.length || input.length > floorplanLimits.inputBytes) throw new Error('Choose a JPG or PNG smaller than 30 MB.')
  const metadata = await sharp(input, { limitInputPixels: floorplanLimits.inputPixels, failOn: 'warning' }).metadata()
  if (!['png', 'jpeg'].includes(metadata.format) || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error('Choose a valid, single-frame JPG or PNG.')
  const rotated = (metadata.orientation ?? 0) >= 5
  const originalWidth = rotated ? metadata.height : metadata.width
  const originalHeight = rotated ? metadata.width : metadata.height
  for (const edge of [4096, 3072, 2048]) {
    const size = fitFloorplan(originalWidth, originalHeight, edge)
    const pipeline = () => sharp(input, { limitInputPixels: floorplanLimits.inputPixels, failOn: 'warning' }).rotate().toColourspace('srgb').resize({ ...size, fit: 'inside', withoutEnlargement: true })
    let output = await pipeline().webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true })
    if (output.data.length > floorplanLimits.targetBytes) {
      for (const quality of [90, 85, 80]) {
        output = await pipeline().webp({ quality, alphaQuality: 100, effort: 4 }).toBuffer({ resolveWithObject: true })
        if (output.data.length <= floorplanLimits.targetBytes) break
      }
    }
    if (output.data.length <= floorplanLimits.maxBytes) return { bytes: output.data, width: output.info.width, height: output.info.height, originalWidth, originalHeight }
  }
  throw new Error('This floorplan cannot fit within 4 MB without reducing detail further. Choose a simpler image or export a smaller drawing.')
}

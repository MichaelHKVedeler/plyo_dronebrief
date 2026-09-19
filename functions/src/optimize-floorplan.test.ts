// @vitest-environment node
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { fitFloorplan, floorplanLimits, optimizeFloorplan } from './optimize-floorplan'

describe('floorplan optimization', () => {
  it('bounds decoded memory and dimensions without enlarging or changing aspect ratio', () => {
    expect(fitFloorplan(1000, 500, 4096)).toEqual({ width: 1000, height: 500 })
    const result = fitFloorplan(10000, 10000, 4096)
    expect(result.width * result.height).toBeLessThanOrEqual(8_000_000)
    expect(result.width).toBe(result.height)
    expect(fitFloorplan(12000, 3000, 4096)).toEqual({ width: 4096, height: 1024 })
  })
  it('produces small WebP with transparency and strips metadata', async () => {
    const input = await sharp({ create: { width: 4200, height: 2200, channels: 4, background: '#00000000' } }).composite([{ input: Buffer.from('<svg width="4200" height="2200"><path d="M20 20H4180V2180H20Z" fill="none" stroke="black" stroke-width="2"/><text x="100" y="200" font-size="48">Floor plan 12.5 m</text></svg>') }]).png().withMetadata().toBuffer()
    const output = await optimizeFloorplan(input)
    const metadata = await sharp(output.bytes).metadata()
    expect(metadata.format).toBe('webp'); expect(metadata.hasAlpha).toBe(true)
    expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined()
    expect(output.width).toBeLessThanOrEqual(4096)
    expect(output.width * output.height).toBeLessThanOrEqual(floorplanLimits.outputPixels)
    expect(output.bytes.length).toBeLessThanOrEqual(floorplanLimits.targetBytes)
    expect(output.width / output.height).toBeCloseTo(4200 / 2200, 2)
  })
  it('applies orientation and preserves smaller dimensions', async () => {
    const input = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const output = await optimizeFloorplan(input)
    expect([output.width, output.height]).toEqual([100, 200])
    expect((await sharp(output.bytes).metadata()).orientation).toBeUndefined()
  })
  it('rejects malformed, unsupported and oversized input', async () => {
    await expect(optimizeFloorplan(Buffer.from('not an image'))).rejects.toThrow()
    await expect(optimizeFloorplan(Buffer.alloc(floorplanLimits.inputBytes + 1))).rejects.toThrow('30 MB')
    const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).webp().toBuffer()
    await expect(optimizeFloorplan(webp)).rejects.toThrow('JPG or PNG')
  })
  it('bounds a detailed noisy photograph that requires lossy encoding', async () => {
    const input = await sharp(randomBytes(4096 * 2048 * 3), { raw: { width: 4096, height: 2048, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()
    const result = await optimizeFloorplan(input)
    expect(result.bytes.length).toBeLessThanOrEqual(floorplanLimits.maxBytes)
    expect(result.width).toBeLessThanOrEqual(4096)
    expect(result.width * result.height).toBeLessThanOrEqual(floorplanLimits.outputPixels)
    expect((await sharp(result.bytes).metadata()).format).toBe('webp')
  }, 60000)
})

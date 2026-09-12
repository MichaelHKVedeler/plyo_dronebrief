import { expect, it, vi, afterEach } from 'vitest'
import { briefSchema, createBrief } from '../model/brief'
import { openSession, reduceSession } from '../state/brief-session'
import { exportBriefKey, importBriefKey } from './share-key'
import { readLocalImage, rememberImageHandle, type LocalImageHandle } from './local-images'

afterEach(() => vi.unstubAllGlobals())
const brief = createBrief({ name: 'Local files', clientName: 'Test', date: '2026-09-13', times: ['09:00'] })
const overlay = { id: 'image', name: 'Plan', source: { kind: 'local-file' as const, fileId: '101dc995-606c-4bc5-a12c-2ce96c6122e4', fileName: 'plan.png' }, position: brief.coordinates, widthMeters: 80, heightMeters: 40, rotationDegrees: 0, opacity: 0.7 }
it('round-trips local references and geometry without file data and enforces read-only updates', () => {
  const withImage = { ...brief, imageOverlays: [overlay] }
  expect(importBriefKey(exportBriefKey(withImage))).toEqual(withImage)
  const viewer = openSession(withImage, 'view')
  expect(reduceSession(viewer, { type: 'update', update: (b) => ({ ...b, imageOverlays: [] }) })).toBe(viewer)
  const hidden = reduceSession(viewer, { type: 'visibility', layer: 'imageOverlays', visible: false })
  expect(hidden.brief).toBe(withImage)
  for (const source of ['blob:temporary', 'file:///C:/plan.png', 'https://example.com/plan.png', { ...overlay.source, fileId: '../plan.png' }]) {
    expect(briefSchema.safeParse({ ...withImage, imageOverlays: [{ ...overlay, source }] }).success).toBe(false)
  }
  expect(briefSchema.parse({ ...brief, imageOverlays: [{ ...overlay, source: 'data:image/png;base64,AAAA' }] }).imageOverlays[0].source).toBe('data:image/png;base64,AAAA')
})
it('rejects wrong formats and oversized files before decoding', async () => {
  await expect(readLocalImage(new File(['svg'], 'plan.svg', { type: 'image/svg+xml' }))).rejects.toThrow('JPG or PNG')
  const large = new File([], 'plan.png', { type: 'image/png' })
  Object.defineProperty(large, 'size', { value: 31 * 1024 * 1024 })
  await expect(readLocalImage(large)).rejects.toThrow('30 MB')
  const fake = { name: 'plan.png', type: 'image/png', size: 8, slice: () => ({ arrayBuffer: async () => new Uint8Array([0, 1, 2]).buffer }) } as unknown as File
  await expect(readLocalImage(fake)).rejects.toThrow('not a valid')
})
it('reports blocked local-reference storage rather than claiming the handle was saved', async () => {
  vi.stubGlobal('indexedDB', { open: () => { throw new Error('Storage blocked') } })
  await expect(rememberImageHandle(overlay.source.fileId, {} as LocalImageHandle)).rejects.toThrow('Storage blocked')
})

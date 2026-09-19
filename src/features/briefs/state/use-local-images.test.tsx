import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocalImages } from './use-local-images'
import { readImageHandle, readLocalImage, rememberImageHandle, type LocalImageHandle } from '../storage/local-images'
import type { ImageOverlay } from '../model/brief'
import { StrictMode } from 'react'
import type { ImageTransport } from '../storage/image-transport'

vi.mock('../storage/local-images', () => ({ readImageHandle: vi.fn(), readLocalImage: vi.fn(), rememberImageHandle: vi.fn() }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('restores file access only after a user gesture, remembers the handle, and releases replaced/removed URLs', async () => {
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
  const file = new File([], 'plan.png', { type: 'image/png' })
  const handle = { getFile: vi.fn(async () => file), queryPermission: vi.fn(async () => 'prompt'), requestPermission: vi.fn(async () => 'granted') } as unknown as LocalImageHandle
  vi.mocked(readImageHandle).mockResolvedValue(handle)
  vi.mocked(rememberImageHandle).mockResolvedValue()
  vi.mocked(readLocalImage).mockResolvedValueOnce({ url: 'blob:first', width: 100, height: 80 }).mockResolvedValueOnce({ url: 'blob:second', width: 100, height: 80 })
  const id = crypto.randomUUID()
  const image: ImageOverlay = { id: 'overlay', name: 'Plan', source: { kind: 'local-file', fileId: id, fileName: 'plan.png' }, position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 80, rotationDegrees: 0, opacity: 0.5 }
  const { result, rerender } = renderHook(({ images }) => useLocalImages(images), { initialProps: { images: [image] } })
  await waitFor(() => expect(result.current.resources[id]?.handle).toBe(handle))
  expect(handle.requestPermission).not.toHaveBeenCalled()
  expect(handle.getFile).not.toHaveBeenCalled()
  await act(() => result.current.allow(id, handle))
  expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' })
  expect(rememberImageHandle).toHaveBeenCalledWith(id, handle)
  expect(result.current.sourceUrl(image)).toBe('blob:first')
  await act(() => result.current.connect(id, file, handle))
  expect(revoke).toHaveBeenCalledWith('blob:first')
  expect(result.current.sourceUrl(image)).toBe('blob:second')
  rerender({ images: [] })
  expect(revoke).toHaveBeenCalledWith('blob:second')
})
it('restarts an interrupted cloud download under StrictMode and releases its private URL', async () => {
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:optimized'); static revokeObjectURL = revoke })
  const id = crypto.randomUUID()
  const image: ImageOverlay = { id: 'overlay', name: 'Plan', source: { kind: 'local-file', fileId: id, fileName: 'plan.png' }, position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 80, rotationDegrees: 30, opacity: 0.5 }
  const load = vi.fn(async (_id: string, signal: AbortSignal) => { await Promise.resolve(); signal.throwIfAborted(); return new Blob(['optimized']) })
  const transport: ImageTransport = { version: 'asset-1', description: 'Cloud floorplan', load }
  const { result, unmount } = renderHook(() => useLocalImages([image], transport), { wrapper: StrictMode })
  await waitFor(() => expect(result.current.sourceUrl(image)).toBe('blob:optimized'))
  expect(load).toHaveBeenCalledTimes(2)
  expect(result.current.resources[id].message).toBeUndefined()
  unmount(); expect(revoke).toHaveBeenCalledWith('blob:optimized')
})
it('does not let an older failed image request hide a successful replacement', async () => {
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:replacement'); static revokeObjectURL = vi.fn() })
  const id = crypto.randomUUID()
  const image: ImageOverlay = { id: 'overlay', name: 'Plan', source: { kind: 'local-file', fileId: id, fileName: 'plan.png' }, position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 80, rotationDegrees: 30, opacity: 0.5 }
  let rejectOld!: (error: Error) => void
  const first: ImageTransport = { version: 'old', description: '', load: () => new Promise((_resolve, reject) => { rejectOld = reject }) }
  const second: ImageTransport = { version: 'new', description: '', load: async () => new Blob(['new']) }
  const { result, rerender } = renderHook(({ transport }) => useLocalImages([image], transport), { initialProps: { transport: first } })
  rerender({ transport: second })
  await act(async () => rejectOld(new Error('Old image disappeared')))
  await waitFor(() => expect(result.current.sourceUrl(image)).toBe('blob:replacement'))
})

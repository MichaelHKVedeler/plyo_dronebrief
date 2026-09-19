import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocalImages } from './use-local-images'
import { readImageHandle, readLocalImage, rememberImageHandle, type LocalImageHandle } from '../storage/local-images'
import type { ImageOverlay } from '../model/brief'

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

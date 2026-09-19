import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePdfAddress } from './use-pdf-address'
import { lookupPdfAddress } from '@/features/map/pdf-address'
vi.mock('@/features/map/pdf-address', () => ({ lookupPdfAddress: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
it('does not overwrite typing when a delayed automatic address arrives', async () => {
  let finish!: (value: string) => void
  vi.mocked(lookupPdfAddress).mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const { result } = renderHook(() => usePdfAddress({ lat: 60, lng: 10 }))
  act(() => result.current.change('Custom address'))
  await act(async () => finish('Automatic street: Oslo'))
  expect(result.current.address).toBe('Custom address')
  expect(result.current.suggestion).toBe('Automatic street: Oslo')
  act(() => result.current.useSuggestion())
  expect(result.current.address).toBe('Automatic street: Oslo')
})
it('keeps manual entry available after a failure and can retry', async () => {
  vi.mocked(lookupPdfAddress).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce('Found street: Area')
  const { result } = renderHook(() => usePdfAddress({ lat: 60, lng: 10 }))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.message).toContain('Enter your own address')
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.address).toBe('Found street: Area'))
})

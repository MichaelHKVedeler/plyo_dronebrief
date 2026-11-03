import { afterEach, expect, it, vi } from 'vitest'
import { publicRequest } from './project-repository'

vi.mock('../auth/firebase', () => ({ firebase: vi.fn(), callCloud: vi.fn(), publicEndpoint: () => 'https://example.test/publicView' }))
afterEach(() => vi.unstubAllGlobals())

it('distinguishes temporary request limits from revoked public links', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })))
  await expect(publicRequest('token')).rejects.toThrow('Too many requests')
})
it('keeps unavailable-link errors for rejected or revoked tokens', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
  await expect(publicRequest('token')).rejects.toThrow('revoked')
})
it('does not describe a temporary limiter outage as link revocation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))
  await expect(publicRequest('token')).rejects.toThrow('temporarily unavailable')
})

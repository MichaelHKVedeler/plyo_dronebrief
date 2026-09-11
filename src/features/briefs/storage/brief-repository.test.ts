import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrief } from '../model/brief'
import { briefRepository } from './brief-repository'

describe('draft repository', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
  it('stores JSON and restores the latest draft', () => {
    const brief = createBrief({ name: 'Test shoot', clientName: 'Test client', date: '2026-09-11', times: ['09:00'] })
    briefRepository.save(brief)
    expect(briefRepository.get(brief.id)).toEqual(brief)
    expect(briefRepository.latest()).toEqual(brief)
    expect(localStorage.getItem('dronebrief:draft:v1:' + brief.id)).toBe(JSON.stringify(brief))
  })
  it('surfaces quota failures to the caller', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(() => briefRepository.save(createBrief({ name: 'Test', clientName: 'Test', date: '2026-09-11', times: ['09:00'] }))).toThrow('Full')
  })
})

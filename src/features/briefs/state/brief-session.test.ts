import { describe, expect, it, vi } from 'vitest'
import { createBrief } from '../model/brief'
import { openSession, reduceSession } from './brief-session'

describe('read-only boundary', () => {
  const brief = createBrief({ name: 'Test shoot', clientName: 'Test client', date: '2026-09-11', times: ['09:00'] })
  it('rejects mutations without invoking the updater in viewer mode', () => {
    const viewer = openSession(brief, 'view')
    const update = vi.fn((value) => ({ ...value, angles: [] }))
    expect(reduceSession(viewer, { type: 'update', update })).toBe(viewer)
    expect(update).not.toHaveBeenCalled()
  })
  it('changes visibility without changing any brief data', () => {
    const viewer = openSession(brief, 'view')
    const next = reduceSession(viewer, { type: 'visibility', layer: 'circleRig', visible: false })
    expect(next.visibility.circleRig).toBe(false)
    expect(next.brief).toBe(brief)
    expect(viewer.visibility.circleRig).toBe(true)
  })
  it('allows validated edits without mutating the original', () => {
    const session = openSession(brief, 'edit')
    const next = reduceSession(session, { type: 'update', update: (b) => ({ ...b, coordinates: { lat: 10, lng: 20 } }) })
    expect(next.brief.coordinates).toEqual({ lat: 10, lng: 20 })
    expect(brief.coordinates).toEqual({ lat: 59.9139, lng: 10.7522 })
    expect(() => reduceSession(session, { type: 'update', update: (b) => ({ ...b, coordinates: { lat: 100, lng: 0 } }) })).toThrow()
  })
})

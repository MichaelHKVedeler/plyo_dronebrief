import { afterEach, expect, it, vi } from 'vitest'
import { briefSchema, createBrief, formatShootTime, projectWithShoots, shootSlots } from './brief'
import { countBriefImages } from './image-count'
import { openSession, reduceSession } from '../state/brief-session'
import { briefRepository } from '../storage/brief-repository'
import { exportBriefKey, importBriefKey } from '../storage/share-key'

afterEach(() => localStorage.clear())
it('saves and shares a range as one shoot, preserving legacy start times', () => {
  const brief = createBrief({ name: 'Range', clientName: 'Test', date: '2026-09-19', times: ['09:00'] })
  brief.angles = [{ id: 'p', label: 'Panorama', type: '360', position: brief.coordinates }]
  const shoots = [{ date: '2026-09-19', time: '09:00', endTime: '12:00' }]
  const next = reduceSession(openSession(brief, 'edit'), { type: 'update', update: (b) => ({ ...b, project: projectWithShoots(b.project, shoots) }) }).brief
  briefRepository.save(next)
  expect(briefRepository.get(next.id)).toEqual(next)
  expect(importBriefKey(exportBriefKey(next))).toEqual(next)
  expect(shootSlots(next.project)).toEqual(shoots)
  expect(next.project.times).toEqual(['09:00'])
  expect(formatShootTime(shoots[0])).toBe('09:00 - 12:00')
  expect(countBriefImages(next)).toEqual(countBriefImages(brief))
  expect(shootSlots(brief.project)).toEqual([{ date: '2026-09-19', time: '09:00' }])
  const viewer = openSession(next, 'view'), update = vi.fn(() => brief)
  expect(reduceSession(viewer, { type: 'update', update })).toBe(viewer)
  expect(update).not.toHaveBeenCalled()
})
it.each(['09:00', '08:59', '24:00', 'bad'])('rejects an invalid range end %s at the data boundary', (endTime) => {
  const brief = createBrief({ name: 'Range', clientName: 'Test' })
  const invalid = { ...brief, project: projectWithShoots(brief.project, [{ date: '2026-09-19', time: '09:00', endTime }]) }
  expect(briefSchema.safeParse(invalid).success).toBe(false)
  expect(() => reduceSession(openSession(brief, 'edit'), { type: 'update', update: () => invalid })).toThrow()
})

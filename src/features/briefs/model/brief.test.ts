import { expect, it } from 'vitest'
import { briefSchema, createBrief, nextShootSlot, projectWithShoots, shootSlots, todayIsoDate } from './brief'

const brief = createBrief({ name: 'Arrows', clientName: 'Test', date: '2026-09-12', times: ['12:00'] })

it('preserves legacy DSLR heights and bearings while defaulting to one arrow', () => {
  const legacy = { ...brief, typeSettings: { ...brief.typeSettings, dslr: { heightsMeters: [1.5, 2] } }, angles: [
    { id: 'a', label: 'Existing DSLR', type: 'dslr', position: brief.coordinates, directionDegrees: 123.456 },
  ] }
  const parsed = briefSchema.parse(legacy)
  expect(parsed.typeSettings.dslr).toEqual({ heightsMeters: [1.5, 2], angleCount: 1, spacingDegrees: 30 })
  expect(parsed.angles).toEqual(legacy.angles)
})

it.each([
  { angleCount: 0, spacingDegrees: 30 }, { angleCount: 13, spacingDegrees: 30 },
  { angleCount: 2.5, spacingDegrees: 30 }, { angleCount: 3, spacingDegrees: 0 },
  { angleCount: 3, spacingDegrees: 14 }, { angleCount: 3, spacingDegrees: 30.5 },
  { angleCount: 4, spacingDegrees: 120 }, { angleCount: 12, spacingDegrees: 31 },
])('rejects invalid or overlapping DSLR settings: %j', (settings) => {
  expect(briefSchema.safeParse({ ...brief, typeSettings: { ...brief.typeSettings, dslr: { ...brief.typeSettings.dslr, ...settings } } }).success).toBe(false)
})

it('creates a brief with today and 09:00 when the wizard omits a schedule', () => {
  const created = createBrief({ name: 'Riverside', clientName: 'Client A' })
  expect(created.project).toMatchObject({ name: 'Riverside', clientName: 'Client A', date: todayIsoDate(), times: ['09:00'] })
  expect(created.project.shoots).toBeUndefined()
})

it('derives up to three shadow slots from a legacy date and times list', () => {
  expect(shootSlots(brief.project)).toEqual([{ date: '2026-09-12', time: '12:00' }])
  expect(shootSlots({ ...brief.project, times: ['08:00', '12:00', '17:00', '20:00'] })).toEqual([
    { date: '2026-09-12', time: '08:00' }, { date: '2026-09-12', time: '12:00' }, { date: '2026-09-12', time: '17:00' },
  ])
})

it('round-trips independent shoot dates while keeping date and times in sync for older readers', () => {
  const shoots = [{ date: '2026-06-01', time: '09:00' }, { date: '2026-06-02', time: '17:00' }]
  const next = { ...brief, project: projectWithShoots(brief.project, shoots) }
  expect(next.project).toMatchObject({ date: '2026-06-01', times: ['09:00', '17:00'], shoots })
  expect(briefSchema.parse(next).project).toMatchObject({ date: '2026-06-01', times: ['09:00', '17:00'], shoots })
  expect(shootSlots(briefSchema.parse({ ...next, project: { ...next.project, shoots: undefined } }).project)).toEqual([
    { date: '2026-06-01', time: '09:00' }, { date: '2026-06-01', time: '17:00' },
  ])
})

it('picks unused default times when stacking shadow sliders', () => {
  expect(nextShootSlot([{ date: '2026-09-12', time: '09:00' }])).toEqual({ date: '2026-09-12', time: '09:15' })
  expect(nextShootSlot([{ date: '2026-09-12', time: '09:00' }, { date: '2026-09-13', time: '12:00' }])).toEqual({ date: '2026-09-13', time: '12:15' })
  expect(nextShootSlot([{ date: '2026-09-12', time: '23:50' }])).toEqual({ date: '2026-09-12', time: '23:45' })
})

import { expect, it } from 'vitest'
import { briefSchema, createBrief, ensureShootRange, next360FloorHeight, nextShootSlot, parseHeightsMeters, projectWithShoots, shootSlots, todayIsoDate } from './brief'

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

it('creates a brief with today and 07:00–17:00 when the wizard omits a schedule', () => {
  const created = createBrief({ name: 'Riverside', clientName: 'Client A' })
  const date = todayIsoDate()
  expect(created.project).toMatchObject({
    name: 'Riverside', clientName: 'Client A', description: '', instructions: '', date, times: ['07:00'],
    shoots: [{ date, time: '07:00', endTime: '17:00' }],
  })
  expect(created.typeSettings['drone-image'].heightsMeters).toEqual([40, 60])
  expect(created.typeSettings['360'].heightsMeters).toEqual([2, 5, 8])
})

it('appends 360 floors 3 m above the last height, starting at 2 m when empty', () => {
  expect(next360FloorHeight([])).toBe(2)
  expect(next360FloorHeight([2, 5, 8])).toBe(11)
  expect(next360FloorHeight([8])).toBe(11)
})

it('parses height lists and ignores a trailing comma while typing', () => {
  expect(parseHeightsMeters('')).toEqual([])
  expect(parseHeightsMeters('2, 5, 8')).toEqual([2, 5, 8])
  expect(parseHeightsMeters('2, 5,')).toEqual([2, 5])
  expect(parseHeightsMeters('2,,5')).toBeNull()
  expect(parseHeightsMeters('nope')).toBeNull()
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

it('defaults missing references and round-trips authored captions', () => {
  const { references: _omitted, ...withoutReferences } = brief
  expect(briefSchema.parse(withoutReferences).references).toEqual([])
  const references = [{ id: 'ref', caption: 'East facade', source: { kind: 'local-file' as const, fileId: crypto.randomUUID(), fileName: 'east.jpg' } }]
  expect(briefSchema.parse({ ...brief, references }).references).toEqual(references)
  expect(briefSchema.safeParse({ ...brief, references: [{ ...references[0], caption: '' }] }).success).toBe(false)
  expect(briefSchema.safeParse({ ...brief, references: Array.from({ length: 5 }, (_, i) => ({ ...references[0], id: String(i) })) }).success).toBe(false)
})

it('defaults missing project notes and round-trips authored description and instructions', () => {
  const { name, clientName, date, times } = brief.project
  const parsed = briefSchema.parse({ ...brief, project: { name, clientName, date, times } }).project
  expect(parsed.description).toBe('')
  expect(parsed.instructions).toBe('')
  expect(briefSchema.parse({ ...brief, project: { ...brief.project, description: 'South facade.', instructions: 'Use the rear gate.' } }).project)
    .toMatchObject({ description: 'South facade.', instructions: 'Use the rear gate.' })
})

it('fills a missing end so every time is a range', () => {
  expect(ensureShootRange({ date: '2026-09-12', time: '09:00' })).toEqual({ date: '2026-09-12', time: '09:00', endTime: '17:00' })
  expect(ensureShootRange({ date: '2026-09-12', time: '09:00', endTime: '12:00' })).toEqual({ date: '2026-09-12', time: '09:00', endTime: '12:00' })
  expect(ensureShootRange({ date: '2026-09-12', time: '18:00' })).toEqual({ date: '2026-09-12', time: '18:00', endTime: '23:59' })
  expect(ensureShootRange({ date: '2026-09-12', time: '23:59' })).toEqual({ date: '2026-09-12', time: '23:44', endTime: '23:59' })
})

it('adds another 07:00–17:00 range on the latest slot date', () => {
  expect(nextShootSlot([{ date: '2026-09-12', time: '09:00' }])).toEqual({ date: '2026-09-12', time: '07:00', endTime: '17:00' })
  expect(nextShootSlot([{ date: '2026-09-12', time: '09:00' }, { date: '2026-09-13', time: '12:00' }])).toEqual({ date: '2026-09-13', time: '07:00', endTime: '17:00' })
  expect(nextShootSlot([{ date: '2026-09-12', time: '23:50' }])).toEqual({ date: '2026-09-12', time: '07:00', endTime: '17:00' })
  expect(nextShootSlot([])).toEqual({ date: todayIsoDate(), time: '07:00', endTime: '17:00' })
})

it('keeps a missing 360 height list on the shared settings and round-trips an override', () => {
  const point = { id: 'p', label: 'Panorama', type: '360' as const, position: brief.coordinates }
  expect(briefSchema.parse({ ...brief, angles: [point] }).angles[0]).toEqual(point)
  const custom = { ...point, heightsMeters: [2, 11] }
  expect(briefSchema.parse({ ...brief, angles: [custom] }).angles[0]).toEqual(custom)
  expect(briefSchema.safeParse({ ...brief, angles: [{ ...custom, heightsMeters: [-1] }] }).success).toBe(false)
  expect(briefSchema.safeParse({ ...brief, angles: [{ ...custom, heightsMeters: [10001] }] }).success).toBe(false)
})

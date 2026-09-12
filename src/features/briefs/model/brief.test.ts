import { expect, it } from 'vitest'
import { briefSchema, createBrief } from './brief'

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

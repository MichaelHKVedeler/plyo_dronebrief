import { expect, it } from 'vitest'
import { shadowTime, timeMinutes } from './shadow-time'

it('uses shoot date and location timezone independently of the browser timezone', () => {
  const oslo = { lat: 59.91, lng: 10.75 }
  expect(shadowTime('2026-07-11', 540, oslo).instant.toISOString()).toBe('2026-07-11T07:00:00.000Z')
  expect(shadowTime('2026-01-11', 540, oslo).instant.toISOString()).toBe('2026-01-11T08:00:00.000Z')
  expect(shadowTime('2026-07-11', 540, { lat: 40.7, lng: -74 }).instant.toISOString()).toBe('2026-07-11T13:00:00.000Z')
})
it('reports a daylight-saving adjustment rather than mislabelling a nonexistent time', () => {
  const time = shadowTime('2026-03-29', 150, { lat: 59.91, lng: 10.75 })
  expect(time.adjusted).toBe(true)
  expect(time.actualTime).not.toBe('02:30')
})
it('converts clock labels to minutes for the shadow sliders', () => {
  expect(timeMinutes('00:00')).toBe(0)
  expect(timeMinutes('09:00')).toBe(540)
  expect(timeMinutes('23:55')).toBe(1435)
})

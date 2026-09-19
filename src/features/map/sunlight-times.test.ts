import { expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import { sunlightPhases, sunlightRange, sunlightTimes, usedSunlightDays } from './sunlight-times'

it('calculates ordered photographic windows in Oslo, including evening blue hour', () => {
  const day = sunlightTimes('2026-09-19', { lat: 59.9139, lng: 10.7522 })
  expect(day.zone).toBe('Europe/Oslo')
  expect(day.condition).toBe('normal')
  for (const phase of sunlightPhases) {
    const window = day.phases[phase]!
    expect(window.start.getTime()).toBeLessThan(window.end.getTime())
    expect(formatInTimeZone(window.start, day.zone, 'yyyy-MM-dd')).toBe(day.date)
    expect(sunlightRange(window, day.date, day.zone)).toMatch(/^\d\d:\d\d - \d\d:\d\d$/)
  }
  expect(day.phases.sunrise!.end).toEqual(day.phases.daytime!.start)
  expect(day.phases.daytime!.end).toEqual(day.phases.sunset!.start)
  expect(day.phases.blueHour!.start.getTime()).toBeGreaterThan(day.phases.sunset!.end.getTime())
})
it.each([
  ['2026-03-07', { lat: 40.7128, lng: -74.006 }, 'America/New_York', '-05:00'],
  ['2026-03-08', { lat: 40.7128, lng: -74.006 }, 'America/New_York', '-04:00'],
  ['2026-09-19', { lat: -36.8485, lng: 174.7633 }, 'Pacific/Auckland', '+12:00'],
] as const)('keeps the solar date and site time zone for %s', (date, position, zone, offset) => {
  const day = sunlightTimes(date, position)
  expect(day.zone).toBe(zone)
  expect(formatInTimeZone(day.phases.sunrise!.start, zone, 'yyyy-MM-dd')).toBe(date)
  expect(formatInTimeZone(day.phases.sunrise!.start, zone, 'xxx')).toBe(offset)
})
it('handles polar night and midnight sun without invalid times', () => {
  const winter = sunlightTimes('2026-12-21', { lat: 69.6492, lng: 18.9553 })
  expect(winter.condition).toBe('polarNight')
  expect(winter.phases.sunrise).toBeNull()
  expect(sunlightRange(winter.phases.sunrise, winter.date, winter.zone)).toBeNull()
  const summer = sunlightTimes('2026-06-21', { lat: 78.2232, lng: 15.6469 })
  expect(summer.condition).toBe('polarDay')
  expect(summer.phases.sunrise).toBeNull()
  expect(sunlightRange(summer.phases.daytime, summer.date, summer.zone)).toBe('00:00 - 00:00 (+1)')
})

const oslo = { lat: 59.9139, lng: 10.7522 }, date = '2026-09-19'
it('includes only the sun periods containing the planned times', () => {
  expect(usedSunlightDays([{ date, time: '12:00' }], oslo)[0].usedPhases).toEqual(['daytime'])
  const day = sunlightTimes(date, oslo)
  const middle = (phase: 'sunrise' | 'sunset') => formatInTimeZone(new Date((day.phases[phase]!.start.getTime() + day.phases[phase]!.end.getTime()) / 2), day.zone, 'HH:mm')
  expect(usedSunlightDays([{ date, time: middle('sunrise') }, { date, time: middle('sunset') }], oslo)[0].usedPhases).toEqual(['sunrise', 'sunset'])
})
it('includes every overlapping period and assigns rounded boundaries to the next period', () => {
  const day = sunlightTimes(date, oslo)
  const start = sunlightRange(day.phases.daytime, date, day.zone)!.slice(0, 5)
  expect(usedSunlightDays([{ date, time: start }], oslo)[0].usedPhases).toEqual(['daytime'])
  expect(usedSunlightDays([{ date, time: '00:00', endTime: '23:59' }], oslo)[0].usedPhases).toEqual([...sunlightPhases])
  expect(usedSunlightDays([{ date, time: '00:00', endTime: start }], oslo)[0].usedPhases).toEqual(['sunrise'])
  expect(usedSunlightDays([{ date, time: '10:00', endTime: '12:00' }], oslo)[0].usedPhases).toEqual(['daytime'])
})
it('does not invent sun periods for night-time or polar-night shoots', () => {
  expect(usedSunlightDays([{ date, time: '01:00', endTime: '02:00' }], oslo)[0].usedPhases).toEqual([])
  expect(usedSunlightDays([{ date: '2026-12-21', time: '12:00' }], { lat: 69.6492, lng: 18.9553 })[0].usedPhases).toEqual([])
  expect(usedSunlightDays([{ date: '2026-06-21', time: '00:00', endTime: '23:59' }], { lat: 78.2232, lng: 15.6469 })[0].usedPhases).toEqual(['daytime'])
})
it('filters independently per date through the site daylight-saving transition', () => {
  const days = usedSunlightDays([{ date: '2026-03-28', time: '12:00' }, { date: '2026-03-29', time: '11:00', endTime: '13:00' }], oslo)
  expect(days.map((day) => day.usedPhases)).toEqual([['daytime'], ['daytime']])
  expect(days.map((day) => formatInTimeZone(day.phases.daytime!.start, day.zone, 'xxx'))).toEqual(['+01:00', '+02:00'])
})

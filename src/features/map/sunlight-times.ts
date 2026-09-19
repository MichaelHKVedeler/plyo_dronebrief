import SunCalc from 'suncalc'
import { formatInTimeZone } from 'date-fns-tz'
import type { Position, ShootSlot } from '@/features/briefs/model/brief'
import { shadowTime, timeMinutes } from './shadow-time'

// Evening photographic blue hour: the sun is between 4 and 6 degrees below
// the horizon. SunCalc's built-in dusk is the -6 degree event.
SunCalc.addTime(-4, 'pdfBlueMorningEnd', 'pdfBlueEveningStart')

export const sunlightPhases = ['sunrise', 'daytime', 'sunset', 'blueHour'] as const
export type SunlightPhase = typeof sunlightPhases[number]
export type SunlightWindow = { start: Date; end: Date } | null

export function sunlightTimes(date: string, position: Position) {
  // Local noon selects the intended solar day even when the browser is in
  // another time zone. Formatting uses the site's zone, including DST.
  const { instant, zone } = shadowTime(date, 12 * 60, position)
  const times = SunCalc.getTimes(instant, position.lat, position.lng)
  const window = (start: Date, end: Date): SunlightWindow => Number.isFinite(start?.getTime()) && Number.isFinite(end?.getTime()) && end > start ? { start, end } : null
  const phases: Record<SunlightPhase, SunlightWindow> = {
    sunrise: window(times.sunrise, times.goldenHourEnd),
    daytime: window(times.goldenHourEnd, times.goldenHour),
    sunset: window(times.goldenHour, times.sunset),
    blueHour: window(times.pdfBlueEveningStart, times.dusk),
  }
  const condition = Number.isFinite(times.sunrise?.getTime()) ? 'normal'
    : SunCalc.getPosition(times.solarNoon, position.lat, position.lng).altitude > 0 ? 'polarDay' : 'polarNight'
  if (!phases.daytime && condition === 'polarDay' && SunCalc.getPosition(times.nadir, position.lat, position.lng).altitude > 6 * Math.PI / 180) {
    const tomorrow = new Date(date + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    phases.daytime = { start: shadowTime(date, 0, position).instant, end: shadowTime(tomorrow.toISOString().slice(0, 10), 0, position).instant }
  }
  return { date, zone, phases, condition } as const
}

export function sunlightRange(window: SunlightWindow, date: string, zone: string) {
  if (!window) return null
  const label = (instant: Date) => {
    const rounded = new Date(Math.round(instant.getTime() / 60_000) * 60_000)
    const day = formatInTimeZone(rounded, zone, 'yyyy-MM-dd')
    return formatInTimeZone(rounded, zone, 'HH:mm') + (day > date ? ' (+1)' : day < date ? ' (-1)' : '')
  }
  return `${label(window.start)} - ${label(window.end)}`
}

export function usedSunlightDays(slots: ShootSlot[], position: Position) {
  return [...new Set(slots.map((slot) => slot.date))].map((date) => {
    const day = sunlightTimes(date, position)
    const intervals = slots.filter((slot) => slot.date === date).map((slot) => ({
      start: shadowTime(date, timeMinutes(slot.time), position).instant.getTime(),
      end: slot.endTime ? shadowTime(date, timeMinutes(slot.endTime), position).instant.getTime() : null,
    }))
    const usedPhases = sunlightPhases.filter((phase) => {
      const window = day.phases[phase]
      if (!window) return false
      // Match the rounded minute boundaries printed in the PDF. Shared
      // boundaries belong to the next period; ranges match any overlap.
      const start = Math.round(window.start.getTime() / 60_000) * 60_000
      const end = Math.round(window.end.getTime() / 60_000) * 60_000
      return intervals.some((slot) => slot.end === null
        ? slot.start >= start && slot.start < end
        : slot.start < end && slot.end > start)
    })
    return { ...day, usedPhases }
  })
}

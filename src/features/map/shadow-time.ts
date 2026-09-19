import tzLookup from 'tz-lookup'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import type { Position } from '@/features/briefs/model/brief'

export function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
export function timeMinutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
}
export const shadowSliderStep = 15
export const shadowSliderMax = 23 * 60 + 45
export function shadowTime(date: string, minutes: number, position: Position) {
  const longitude = ((position.lng + 180) % 360 + 360) % 360 - 180
  const zone = tzLookup(position.lat, longitude)
  const instant = fromZonedTime(`${date}T${timeLabel(minutes)}:00`, zone)
  const actualTime = formatInTimeZone(instant, zone, 'HH:mm')
  return { instant, zone, actualTime, adjusted: actualTime !== timeLabel(minutes) }
}

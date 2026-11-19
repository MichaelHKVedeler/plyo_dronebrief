import { maxShootRangeMinutes, type ShootSlot } from '@/features/briefs/model/brief'
import { shadowSliderMax, shadowSliderStep, timeLabel, timeMinutes } from './shadow-time'

export type ShootEndpoint = 0 | 1

export function previewShootSlot(slot: ShootSlot, endpoint: ShootEndpoint): ShootSlot {
  return { date: slot.date, time: endpoint === 1 && slot.endTime ? slot.endTime : slot.time }
}

export function addShootRange(slot: ShootSlot, minutes = timeMinutes(slot.time) + 60) {
  if (slot.endTime) return { slot, retainedEndpoint: 0 as ShootEndpoint }
  const start = timeMinutes(slot.time)
  let end = Math.max(0, Math.min(shadowSliderMax, Math.round(minutes)))
  if (end === start) end = start + shadowSliderStep <= shadowSliderMax ? start + shadowSliderStep : start - shadowSliderStep
  return end < start
    ? { slot: { ...slot, time: timeLabel(end), endTime: slot.time }, retainedEndpoint: 1 as ShootEndpoint }
    : { slot: { ...slot, endTime: timeLabel(end) }, retainedEndpoint: 0 as ShootEndpoint }
}

export function moveShootEndpoint(slot: ShootSlot, endpoint: ShootEndpoint, minutes: number): ShootSlot {
  const min = endpoint === 1 && slot.endTime ? timeMinutes(slot.time) + 1 : 0
  const max = endpoint === 0 && slot.endTime ? timeMinutes(slot.endTime) - 1 : shadowSliderMax
  const moved = Math.max(min, Math.min(max, Math.round(minutes)))
  const value = timeLabel(moved)
  if (!slot.endTime) return { ...slot, time: value }
  // Past the two-hour cap the other endpoint follows, so the window slides instead of stretching.
  if (endpoint === 1) return { ...slot, endTime: value, time: timeLabel(Math.max(timeMinutes(slot.time), moved - maxShootRangeMinutes)) }
  return { ...slot, time: value, endTime: timeLabel(Math.min(timeMinutes(slot.endTime), moved + maxShootRangeMinutes)) }
}

/** Slides the whole range by `minutes`, stopping at either end of the day so its length never changes. */
export function moveShootRange(slot: ShootSlot, minutes: number): ShootSlot {
  if (!slot.endTime) return slot
  const start = timeMinutes(slot.time), end = timeMinutes(slot.endTime)
  const delta = Math.max(-start, Math.min(shadowSliderMax - end, Math.round(minutes)))
  return { ...slot, time: timeLabel(start + delta), endTime: timeLabel(end + delta) }
}

import type { ShootSlot } from '@/features/briefs/model/brief'
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
  const value = timeLabel(Math.max(min, Math.min(max, Math.round(minutes))))
  return endpoint === 1 && slot.endTime ? { ...slot, endTime: value } : { ...slot, time: value }
}

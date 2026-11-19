import { expect, it } from 'vitest'
import { addShootRange, moveShootEndpoint, moveShootRange, previewShootSlot } from './shoot-time-range'
const single = { date: '2026-09-19', time: '09:00' }
it('adds an endpoint on either side without changing the previewed instant', () => {
  for (const minutes of [360, 540, 720]) {
    const added = addShootRange(single, minutes)
    expect(added.slot.endTime! > added.slot.time).toBe(true)
    expect(previewShootSlot(added.slot, added.retainedEndpoint)).toEqual(single)
  }
  expect(addShootRange({ ...single, time: '23:59' }).slot).toMatchObject({ time: '23:44', endTime: '23:59' })
})
it('moves only the selected endpoint and prevents crossed or zero-length ranges', () => {
  const slot = { ...single, endTime: '11:00' }
  expect(moveShootEndpoint(slot, 0, 600)).toEqual({ ...slot, time: '10:00' })
  expect(moveShootEndpoint(slot, 1, 600)).toEqual({ ...slot, endTime: '10:00' })
  expect(moveShootEndpoint(slot, 0, 900)).toEqual({ ...slot, time: '10:59' })
  expect(moveShootEndpoint(slot, 1, 400)).toEqual({ ...slot, endTime: '09:01' })
  expect(previewShootSlot(slot, 1)).toEqual({ date: single.date, time: '11:00' })
})
it('keeps a range at most two hours by dragging the other endpoint along', () => {
  const slot = { ...single, endTime: '11:00' }
  expect(moveShootEndpoint(slot, 1, 780)).toEqual({ ...slot, time: '11:00', endTime: '13:00' })
  expect(moveShootEndpoint(slot, 0, 420)).toEqual({ ...slot, time: '07:00', endTime: '09:00' })
  expect(moveShootEndpoint(single, 0, 2000).time).toBe('23:59')
})
it('moves a whole range without changing its length, stopping at either end of the day', () => {
  const slot = { ...single, endTime: '11:00' }
  expect(moveShootRange(slot, 90)).toEqual({ ...slot, time: '10:30', endTime: '12:30' })
  expect(moveShootRange(slot, -900)).toEqual({ ...slot, time: '00:00', endTime: '02:00' })
  expect(moveShootRange(slot, 900)).toEqual({ ...slot, time: '21:59', endTime: '23:59' })
  expect(moveShootRange(single, 60)).toBe(single)
})

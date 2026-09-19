import { expect, it } from 'vitest'
import { addShootRange, moveShootEndpoint, previewShootSlot } from './shoot-time-range'
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
  const slot = { ...single, endTime: '14:00' }
  expect(moveShootEndpoint(slot, 0, 600)).toEqual({ ...slot, time: '10:00' })
  expect(moveShootEndpoint(slot, 1, 600)).toEqual({ ...slot, endTime: '10:00' })
  expect(moveShootEndpoint(slot, 0, 900)).toEqual({ ...slot, time: '13:59' })
  expect(moveShootEndpoint(slot, 1, 400)).toEqual({ ...slot, endTime: '09:01' })
  expect(previewShootSlot(slot, 1)).toEqual({ date: single.date, time: '14:00' })
  expect(moveShootEndpoint(single, 0, 2000).time).toBe('23:59')
})

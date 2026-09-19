import { afterEach, expect, it } from 'vitest'
import { angleSchema, briefSchema, createBrief } from './brief'
import { briefRepository } from '../storage/brief-repository'
import { exportBriefKey, importBriefKey } from '../storage/share-key'
import { openSession, reduceSession } from '../state/brief-session'
import { duplicateCamera } from './camera-numbers'

const panorama = { id: 'p', label: 'Panorama', type: '360' as const, position: { lat: 59.9, lng: 10.7 } }
const focus = { directionDegrees: 270, fovDegrees: 120 }
afterEach(() => localStorage.clear())

it('leaves legacy 360 points unfocused and rejects incomplete or invalid focus data', () => {
  expect(angleSchema.parse(panorama)).toEqual(panorama)
  for (const invalid of [null, {}, { ...focus, directionDegrees: 360 }, { ...focus, directionDegrees: -1 }, { ...focus, fovDegrees: 0 }, { ...focus, fovDegrees: 181 }, { ...focus, fovDegrees: Infinity }]) {
    expect(angleSchema.safeParse({ ...panorama, focus: invalid }).success).toBe(false)
  }
})

it('saves, exports, reloads, moves and duplicates 360 focus without changing the panorama position', () => {
  const brief = createBrief({ name: 'Focus test', clientName: 'Test' })
  brief.angles = [panorama]
  const edited = reduceSession(openSession(brief, 'edit'), { type: 'update', update: (b) => ({ ...b, angles: [{ ...panorama, focus }] }) }).brief
  expect(edited.angles[0]).toEqual({ ...panorama, focus })
  expect(brief.angles[0]).toEqual(panorama)
  briefRepository.save(edited)
  expect(briefRepository.get(edited.id)).toEqual(edited)
  expect(importBriefKey(exportBriefKey(edited))).toEqual(edited)
  const copy = duplicateCamera(edited.angles[0], { lat: 60, lng: 11 }, 'copy', edited.angles)
  expect(copy).toMatchObject({ type: '360', position: { lat: 60, lng: 11 }, focus })
  expect(briefSchema.parse({ ...edited, angles: [copy] }).angles[0]).toEqual(copy)
  const viewer = openSession(edited, 'view')
  expect(reduceSession(viewer, { type: 'update', update: (b) => ({ ...b, angles: [panorama] }) })).toBe(viewer)
})

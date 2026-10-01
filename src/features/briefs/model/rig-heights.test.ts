import { afterEach, expect, it } from 'vitest'
import { briefSchema, createBrief, effectiveRigHeights } from './brief'
import { countBriefImages } from './image-count'
import { exportBriefKey, importBriefKey } from '../storage/share-key'
import { briefRepository } from '../storage/brief-repository'
import { openSession, reduceSession } from '../state/brief-session'
import { captureInstructions } from '../components/capture-instructions'
import { pdfProjectSize } from '../export/pdf-project'

function fixture() {
  const brief = createBrief({ name: 'Rig heights', clientName: 'Test' })
  brief.circleRig = { id: 'rig', position: brief.coordinates, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0, arrowCount: 10 }
  return brief
}
afterEach(() => localStorage.clear())
it('preserves legacy counts and uses independent rig heights for counts and instructions', () => {
  const brief = fixture()
  expect(effectiveRigHeights(briefSchema.parse(brief))).toEqual([40, 60])
  expect(countBriefImages(brief).circleRig).toBe(20)
  brief.circleRig!.heightsMeters = [15, 25, 35]
  brief.project.shoots = [{ date: '2026-09-29', time: '09:00' }, { date: '2026-09-29', time: '12:00' }]
  brief.angles = [{ id: 'd', label: 'Drone', type: 'drone-image', position: brief.coordinates, directionDegrees: 0 }]
  expect(countBriefImages(brief)).toMatchObject({ circleRig: 60, droneImage: 4, total: 64 })
  expect(captureInstructions(brief, 'en')[0]).toMatchObject({ heights: '15m, 25m, 35m', images: 60 })
  expect(pdfProjectSize(brief)).toBe('large')
  brief.circleRig!.heightsMeters = []
  expect(countBriefImages(brief).circleRig).toBe(0)
})
it('round-trips rig heights through validated edits, draft storage and portable keys', () => {
  const brief = fixture()
  const action = { type: 'update' as const, update: (b: typeof brief) => ({ ...b, circleRig: { ...b.circleRig!, heightsMeters: [12, 24] } }) }
  const edited = reduceSession(openSession(brief, 'edit'), action).brief
  briefRepository.save(edited)
  expect(briefRepository.get(brief.id)?.circleRig?.heightsMeters).toEqual([12, 24])
  expect(importBriefKey(exportBriefKey(edited)).circleRig?.heightsMeters).toEqual([12, 24])
  const viewer = openSession(brief, 'view')
  expect(reduceSession(viewer, action)).toBe(viewer)
  expect(brief.circleRig?.heightsMeters).toBeUndefined()
})
it.each([[-1], [10001], [Infinity], Array(51).fill(10)].map((heightsMeters) => ({ heightsMeters })))('rejects invalid rig height lists', ({ heightsMeters }) => {
  const brief = fixture()
  expect(briefSchema.safeParse({ ...brief, circleRig: { ...brief.circleRig, heightsMeters } }).success).toBe(false)
})

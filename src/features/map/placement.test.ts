import { describe, expect, it } from 'vitest'
import { angleSchema, createBrief } from '@/features/briefs/model/brief'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'
import { exportBriefKey, importBriefKey } from '@/features/briefs/storage/share-key'
import { aimPlacement, idleTool, placeCamera, startCameraPlacement } from './placement'
import { destination } from './geometry'

const position = { lat: 51.5, lng: -0.1 }
describe('camera placement', () => {
  it.each(['360', 'extra-coverage'] as const)('places %s in one click with no direction property', (type) => {
    const result = placeCamera(startCameraPlacement(type), position, 'a', 1)
    expect(result.tool).toEqual(startCameraPlacement(type))
    expect(result.angle).toEqual({ id: 'a', label: `${type === '360' ? '360' : 'Extra coverage'} 1`, type, position })
    expect(angleSchema.safeParse(result.angle).success).toBe(true)
  })
  it.each(['dslr', 'drone-image'] as const)('requires position then look-at for %s', (type) => {
    const first = placeCamera(startCameraPlacement(type), position, 'discarded', 1)
    expect(first.angle).toBeUndefined()
    const target = destination(position, 50, 135)
    const aimed = aimPlacement(first.tool, target)
    const second = placeCamera(aimed, target, 'saved-id', 1)
    expect(second.tool).toEqual(startCameraPlacement(type))
    expect(second.angle?.position).toEqual(position)
    expect(second.angle?.id).toBe('saved-id')
    expect(second.angle && 'directionDegrees' in second.angle ? second.angle.directionDegrees : NaN).toBeCloseTo(135)
    expect(angleSchema.safeParse(second.angle).success).toBe(true)
  })
  it('uses the current direction without movement and rejects cancelled placement', () => {
    const first = placeCamera(startCameraPlacement('dslr'), position, 'a', 1)
    expect(placeCamera(first.tool, position, 'a', 1).angle).toMatchObject({ directionDegrees: 0 })
    expect(placeCamera(idleTool, position, 'a', 1).angle).toBeUndefined()
  })
  it('saves moved and aimed drone-image data in exports but refuses it in a viewer', () => {
    const brief = createBrief({ name: 'Test', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
    const moved = { id: 'a', label: 'Camera 1', type: 'drone-image' as const, position, directionDegrees: 270 }
    const action = { type: 'update' as const, update: (b: typeof brief) => ({ ...b, angles: [moved] }) }
    const editor = reduceSession(openSession(brief, 'edit'), action)
    expect(importBriefKey(exportBriefKey(editor.brief)).angles).toEqual([moved])
    const viewer = openSession(editor.brief, 'view')
    expect(reduceSession(viewer, { type: 'update', update: (b) => ({ ...b, angles: [] }) })).toBe(viewer)
  })
})

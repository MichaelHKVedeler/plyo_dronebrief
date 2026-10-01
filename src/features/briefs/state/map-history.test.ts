import { describe, expect, it } from 'vitest'
import { createBrief, type DroneBrief } from '../model/brief'
import { exportBriefKey, importBriefKey } from '../storage/share-key'
import { openSession, reduceSession, type BriefSession } from './brief-session'
import { mapHistoryLimit } from './map-history'

function scene() {
  const brief = createBrief({ name: 'History', clientName: 'Test' })
  brief.angles = [
    { id: 'drone', label: 'Drone', type: 'drone-image', position: brief.coordinates, directionDegrees: 15 },
    { id: 'dslr', label: 'DSLR', type: 'dslr', position: brief.coordinates, directionDegrees: 30 },
    { id: '360', label: '360', type: '360', position: brief.coordinates },
    { id: 'extra', label: 'Extra', type: 'extra-coverage', position: brief.coordinates },
  ]
  brief.circleRig = { id: 'rig', position: brief.coordinates, radiusMeters: 50, ovalRatio: 1, rotationDegrees: 0, arrowCount: 10 }
  brief.droneScan = { id: 'scan', highRes: { id: 'high', position: brief.coordinates, radiusMeters: 250 }, lowRes: { id: 'low', position: brief.coordinates, radiusMeters: 400 } }
  brief.imageOverlays = [{ id: 'image', name: 'Plan', source: 'data:image/png;base64,AA==', position: brief.coordinates, widthMeters: 100, heightMeters: 60, rotationDegrees: 0, opacity: 0.5 }]
  brief.polygons = [{ id: 'polygon', label: 'Building', vertices: [brief.coordinates, { lat: 60, lng: 11 }, { lat: 61, lng: 10 }] }]
  return brief
}
const edit = (session: BriefSession, update: (brief: DroneBrief) => DroneBrief) => reduceSession(session, { type: 'update', update })
const undo = (session: BriefSession) => reduceSession(session, { type: 'update', history: 'undo' })
const redo = (session: BriefSession) => reduceSession(session, { type: 'update', history: 'redo' })

describe('map transform history', () => {
  it('reverses mixed map transforms in order and redoes them exactly, with one step per commit', () => {
    const original = scene()
    const originalSnapshot = structuredClone(original)
    let session = openSession(original, 'edit')
    const steps: ((brief: DroneBrief) => DroneBrief)[] = [
      (b) => ({ ...b, angles: b.angles.map((a) => ({ ...a, position: { lat: 60, lng: 11 } })) }),
      (b) => ({ ...b, angles: b.angles.map((a) => a.type === 'dslr' || a.type === 'drone-image' ? { ...a, directionDegrees: 275 } : a) }),
      (b) => ({ ...b, angles: b.angles.map((a) => a.type === '360' ? { ...a, focus: { directionDegrees: 90, fovDegrees: 80 } } : a) }),
      (b) => ({ ...b, circleRig: { ...b.circleRig!, position: { lat: 59, lng: 12 } } }),
      (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 120, rotationDegrees: 310 } }),
      (b) => ({ ...b, circleRig: { ...b.circleRig!, ovalRatio: 0.4 } }),
      (b) => ({ ...b, droneScan: { ...b.droneScan!, highRes: { ...b.droneScan!.highRes!, position: { lat: 60, lng: 12 } }, lowRes: { ...b.droneScan!.lowRes!, position: { lat: 60, lng: 12 } } } }),
      (b) => ({ ...b, droneScan: { ...b.droneScan!, highRes: { ...b.droneScan!.highRes!, radiusMeters: 150 } } }),
      (b) => ({ ...b, imageOverlays: b.imageOverlays.map((image) => ({ ...image, position: { lat: 61, lng: 9 } })) }),
      (b) => ({ ...b, imageOverlays: b.imageOverlays.map((image) => ({ ...image, position: { lat: 61.1, lng: 9.1 }, widthMeters: 150, heightMeters: 90, rotationDegrees: 45 })) }),
      (b) => ({ ...b, polygons: b.polygons.map((p) => ({ ...p, vertices: p.vertices.map((v) => ({ ...v, lat: v.lat + 0.1 })) })) }),
    ]
    const snapshots = [original]
    for (const step of steps) { session = edit(session, step); snapshots.push(session.brief) }
    expect(session.history.past).toHaveLength(steps.length)
    for (let index = steps.length - 1; index >= 0; index--) {
      session = undo(session)
      expect(session.brief).toEqual({ ...snapshots[index], updatedAt: session.brief.updatedAt })
    }
    expect(session.brief.angles[2]).not.toHaveProperty('focus')
    expect(undo(session)).toBe(session)
    for (let index = 1; index <= steps.length; index++) {
      session = redo(session)
      expect(session.brief).toEqual({ ...snapshots[index], updatedAt: session.brief.updatedAt })
    }
    expect(redo(session)).toBe(session)
    expect(original).toEqual(originalSnapshot)
  })

  it('preserves unrelated edits, display settings and replacement image sources across undo/redo', () => {
    let session = openSession(scene(), 'edit')
    session = edit(session, (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 80 }, imageOverlays: b.imageOverlays.map((i) => ({ ...i, rotationDegrees: 180 })) }))
    session = edit(session, (b) => ({ ...b, project: { ...b.project, name: 'Renamed' }, circleRig: { ...b.circleRig!, arrowCount: 20 }, imageOverlays: b.imageOverlays.map((i) => ({ ...i, source: 'data:image/png;base64,AQ==', opacity: 0.8 })) }))
    session = reduceSession(session, { type: 'visibility', layer: 'circleRig', visible: false })
    session = undo(session)
    expect(session.brief.circleRig).toMatchObject({ radiusMeters: 50, arrowCount: 20 })
    expect(session.brief.imageOverlays[0]).toMatchObject({ rotationDegrees: 0, opacity: 0.8, source: 'data:image/png;base64,AQ==' })
    expect(session.brief.project.name).toBe('Renamed')
    expect(session.visibility.circleRig).toBe(false)
    session = edit(session, (b) => ({ ...b, typeSettings: { ...b.typeSettings, '360': { heightsMeters: [25] } } }))
    session = redo(session)
    expect(session.brief.circleRig?.radiusMeters).toBe(80)
    expect(session.brief.typeSettings['360'].heightsMeters).toEqual([25])
  })

  it('discards the redo branch after a new transform and ignores no-op updates', () => {
    const original = openSession(scene(), 'edit')
    expect(edit(original, (b) => b)).toBe(original)
    let session = edit(original, (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 75 } }))
    session = undo(session)
    expect(edit(session, (b) => b)).toBe(session)
    session = edit(session, (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 90 } }))
    expect(session.history.future).toEqual([])
    expect(redo(session)).toBe(session)
    expect(undo(session).brief.circleRig?.radiusMeters).toBe(50)
  })

  it('undoes and redoes camera additions and deletions with their data and order intact', () => {
    let session = openSession(scene(), 'edit')
    const added = { id: 'added', label: 'Added 360', type: '360' as const, position: { lat: 58, lng: 12 }, heightsMeters: [3, 6], focus: { directionDegrees: 45, fovDegrees: 70 } }
    session = edit(session, (b) => ({ ...b, angles: [...b.angles.slice(0, 2), added, ...b.angles.slice(2)] }))
    expect(session.brief.angles[2]).toEqual(added)
    session = undo(session)
    expect(session.brief.angles.map((angle) => angle.id)).toEqual(['drone', 'dslr', '360', 'extra'])
    session = redo(session)
    expect(session.brief.angles[2]).toEqual(added)

    session = edit(session, (b) => ({ ...b, angles: b.angles.filter((angle) => !['dslr', '360'].includes(angle.id)) }))
    expect(session.brief.angles.map((angle) => angle.id)).toEqual(['drone', 'added', 'extra'])
    session = undo(session)
    expect(session.brief.angles.map((angle) => angle.id)).toEqual(['drone', 'dslr', 'added', '360', 'extra'])
    expect(session.brief.angles[3]).toMatchObject({ id: '360', label: '360', type: '360' })
    session = redo(session)
    expect(session.brief.angles.map((angle) => angle.id)).toEqual(['drone', 'added', 'extra'])
  })

  it('retains earlier point transforms after undoing a deletion', () => {
    let session = openSession(scene(), 'edit')
    session = edit(session, (b) => ({ ...b, angles: b.angles.map((a) => ({ ...a, position: { lat: 58, lng: 11 } })) }))
    session = edit(session, (b) => ({ ...b, angles: b.angles.filter((a) => a.id !== 'drone') }))
    session = undo(session)
    expect(session.brief.angles).toHaveLength(4)
    expect(session.brief.angles[0]).toMatchObject({ id: 'drone', position: { lat: 58, lng: 11 } })
    session = undo(session)
    expect(session.brief.angles.every((angle) => angle.position.lat === scene().coordinates.lat)).toBe(true)
  })

  it('undoes and redoes adding and removing the circle rig with all settings intact', () => {
    const brief = scene()
    const rig = { ...brief.circleRig!, heightsMeters: [20, 35], arrowCount: 18, ovalRatio: 0.6, rotationDegrees: 45 }
    brief.circleRig = null
    let session = openSession(brief, 'edit')
    session = edit(session, (b) => ({ ...b, circleRig: rig }))
    expect(session.brief.circleRig).toEqual(rig)
    session = undo(session)
    expect(session.brief.circleRig).toBeNull()
    session = redo(session)
    expect(session.brief.circleRig).toEqual(rig)

    const configured = { ...rig, heightsMeters: [25, 50], arrowCount: 22 }
    session = edit(session, (b) => ({ ...b, circleRig: configured }))
    session = undo(session)
    expect(session.brief.circleRig).toBeNull()
    session = redo(session)
    expect(session.brief.circleRig).toEqual(configured)

    session = edit(session, (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 90 } }))
    session = edit(session, (b) => ({ ...b, circleRig: null }))
    session = undo(session)
    expect(session.brief.circleRig).toEqual({ ...configured, radiusMeters: 90 })
    session = undo(session)
    expect(session.brief.circleRig).toEqual(configured)
    session = redo(session)
    session = redo(session)
    expect(session.brief.circleRig).toBeNull()
  })

  it('undoes and redoes adding and removing each drone scan circle', () => {
    const brief = scene()
    const highRes = brief.droneScan!.highRes!
    const lowRes = brief.droneScan!.lowRes!
    brief.droneScan = null
    let session = openSession(brief, 'edit')
    session = edit(session, (b) => ({ ...b, droneScan: { id: 'scan', highRes, lowRes: null } }))
    session = edit(session, (b) => ({ ...b, droneScan: { ...b.droneScan!, lowRes } }))
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes, lowRes })
    session = undo(session)
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes, lowRes: null })
    session = undo(session)
    expect(session.brief.droneScan).toBeNull()
    session = redo(session)
    session = redo(session)
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes, lowRes })

    session = edit(session, (b) => ({ ...b, droneScan: { ...b.droneScan!, highRes: null } }))
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes: null, lowRes })
    session = undo(session)
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes, lowRes })
    session = redo(session)
    expect(session.brief.droneScan).toEqual({ id: 'scan', highRes: null, lowRes })
  })

  it('bounds memory, resets on opening a brief and omits history from portable snapshots', () => {
    let session = openSession(scene(), 'edit')
    for (let index = 0; index < mapHistoryLimit + 10; index++) session = edit(session, (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 51 + index } }))
    expect(session.history.past).toHaveLength(mapHistoryLimit)
    const restored = importBriefKey(exportBriefKey(session.brief))
    expect(restored).not.toHaveProperty('history')
    expect(openSession(restored, 'edit').history).toEqual({ past: [], future: [] })
    for (let index = 0; index < mapHistoryLimit; index++) session = undo(session)
    expect(session.brief.circleRig?.radiusMeters).toBe(60)
    expect(undo(session)).toBe(session)
  })

  it('rejects history actions at the read-only boundary, even with retained edit history', () => {
    const edited = edit(openSession(scene(), 'edit'), (b) => ({ ...b, circleRig: { ...b.circleRig!, radiusMeters: 80 } }))
    const viewer = { ...edited, mode: 'view' as const }
    expect(undo(viewer)).toBe(viewer)
    expect(redo(viewer)).toBe(viewer)
    expect(undo(openSession(scene(), 'edit')).history.past).toEqual([])
  })
})

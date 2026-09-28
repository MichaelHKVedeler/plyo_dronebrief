import type { CameraAngle, DroneBrief } from '../model/brief'

export const mapHistoryLimit = 100

function cameraGeometry(angle: CameraAngle) {
  const base = { position: angle.position, type: angle.type }
  if (angle.type === '360') return { ...base, type: angle.type, focus: angle.focus }
  if (angle.type === 'extra-coverage') return { ...base, type: angle.type }
  return { ...base, type: angle.type, directionDegrees: angle.directionDegrees }
}

// Keep only geometry: history must never restore old titles, heights or image sources.
function mapGeometry(brief: DroneBrief) {
  const rig = brief.circleRig
  const scan = brief.droneScan
  return [
    ...brief.angles.map((angle) => ({ kind: 'camera' as const, id: angle.id, geometry: cameraGeometry(angle) })),
    ...(rig ? [{ kind: 'rig' as const, id: rig.id, geometry: {
      position: rig.position, radiusMeters: rig.radiusMeters, rotationDegrees: rig.rotationDegrees, ovalRatio: rig.ovalRatio,
    } }] : []),
    ...(scan ? [{ kind: 'scan' as const, id: scan.id, geometry: scan }] : []),
    ...brief.imageOverlays.map((image) => ({ kind: 'image' as const, id: image.id, geometry: {
      position: image.position, widthMeters: image.widthMeters, heightMeters: image.heightMeters, rotationDegrees: image.rotationDegrees,
    } })),
    ...brief.polygons.map((polygon) => ({ kind: 'polygon' as const, id: polygon.id, geometry: { vertices: polygon.vertices } })),
  ]
}

type MapGeometry = ReturnType<typeof mapGeometry>[number]
type MapHistoryEntry = { before: MapGeometry[]; after: MapGeometry[] }
export type MapHistory = { past: MapHistoryEntry[]; future: MapHistoryEntry[] }

function identity(item: MapGeometry) {
  // A changed camera type or scan membership starts a new transformable object.
  const shape = item.kind === 'camera' ? item.geometry.type
    : item.kind === 'scan' ? `${item.geometry.highRes?.id}/${item.geometry.lowRes?.id}` : ''
  return `${item.kind}:${item.id}:${shape}`
}

export function recordMapHistory(history: MapHistory, previous: DroneBrief, next: DroneBrief): MapHistory {
  const before = new Map(mapGeometry(previous).map((item) => [identity(item), item]))
  const after = new Map(mapGeometry(next).map((item) => [identity(item), item]))
  const entry: MapHistoryEntry = { before: [], after: [] }
  for (const [key, item] of after) {
    const original = before.get(key)
    if (original && JSON.stringify(original.geometry) !== JSON.stringify(item.geometry)) {
      entry.before.push(original)
      entry.after.push(item)
    }
  }
  // Removing/replacing an object must not let a later undo resurrect it. Keep
  // independent objects' history, and discard a linked transform as one unit.
  const valid = (value: MapHistoryEntry) => value.after.every((item) => after.has(identity(item)))
  const past = history.past.filter(valid)
  const changedObjects = before.size !== after.size || [...before.keys()].some((key) => !after.has(key))
  return {
    past: entry.before.length ? [...past, entry].slice(-mapHistoryLimit) : past,
    future: entry.before.length || changedObjects ? [] : history.future.filter(valid),
  }
}

export function restoreMapHistory(brief: DroneBrief, entry: MapHistoryEntry, direction: 'undo' | 'redo'): DroneBrief {
  let result = brief
  for (const item of direction === 'undo' ? entry.before : entry.after) {
    switch (item.kind) {
      case 'camera':
        result = { ...result, angles: result.angles.map((angle) => {
          if (angle.id !== item.id || angle.type !== item.geometry.type) return angle
          const position = item.geometry.position
          if (angle.type === '360' && item.geometry.type === '360') {
            const { focus: _focus, ...rest } = angle
            return { ...rest, position, ...(item.geometry.focus ? { focus: item.geometry.focus } : {}) }
          }
          if ((angle.type === 'dslr' || angle.type === 'drone-image') && 'directionDegrees' in item.geometry) {
            return { ...angle, position, directionDegrees: item.geometry.directionDegrees }
          }
          return { ...angle, position }
        }) }
        break
      case 'rig':
        if (result.circleRig?.id === item.id) result = { ...result, circleRig: { ...result.circleRig, ...item.geometry } }
        break
      case 'scan':
        if (result.droneScan?.id === item.id) result = { ...result, droneScan: item.geometry }
        break
      case 'image':
        result = { ...result, imageOverlays: result.imageOverlays.map((image) => image.id === item.id ? { ...image, ...item.geometry } : image) }
        break
      case 'polygon':
        result = { ...result, polygons: result.polygons.map((polygon) => polygon.id === item.id ? { ...polygon, ...item.geometry } : polygon) }
        break
    }
  }
  return result
}

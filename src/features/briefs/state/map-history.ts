import type { CameraAngle, DroneBrief } from '../model/brief'

export const mapHistoryLimit = 100

function cameraGeometry(angle: CameraAngle) {
  const base = { position: angle.position, type: angle.type }
  if (angle.type === '360') return { ...base, type: angle.type, focus: angle.focus }
  if (angle.type === 'extra-coverage') return { ...base, type: angle.type }
  return { ...base, type: angle.type, directionDegrees: angle.directionDegrees }
}

// Existing-object edits compare and restore geometry only. Lifecycle snapshots
// let undo recreate removed camera points and rigs with all of their settings.
function mapGeometry(brief: DroneBrief) {
  const rig = brief.circleRig
  const scan = brief.droneScan
  return [
    ...brief.angles.map((angle, index) => ({ kind: 'camera' as const, id: angle.id, index, angle, geometry: cameraGeometry(angle) })),
    ...(rig ? [{ kind: 'rig' as const, id: rig.id, rig, geometry: {
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
type CameraMapGeometry = Extract<MapGeometry, { kind: 'camera' }>
type MapHistoryEntry = { before: MapGeometry[]; after: MapGeometry[] }
export type MapHistory = { past: MapHistoryEntry[]; future: MapHistoryEntry[] }

function cameraWithGeometry(angle: CameraAngle, item: CameraMapGeometry): CameraAngle {
  const position = item.geometry.position
  if (angle.type === '360' && item.geometry.type === '360') {
    const { focus: _focus, ...rest } = angle
    return { ...rest, position, ...(item.geometry.focus ? { focus: item.geometry.focus } : {}) }
  }
  if ((angle.type === 'dslr' || angle.type === 'drone-image') && 'directionDegrees' in item.geometry) {
    return { ...angle, position, directionDegrees: item.geometry.directionDegrees }
  }
  return { ...angle, position }
}

function identity(item: MapGeometry) {
  // A changed camera type or scan membership starts a new transformable object.
  const shape = item.kind === 'camera' ? item.geometry.type
    : item.kind === 'scan' ? `${item.geometry.highRes?.id}/${item.geometry.lowRes?.id}` : ''
  return `${item.kind}:${item.id}:${shape}`
}

export function recordMapHistory(history: MapHistory, previous: DroneBrief, next: DroneBrief): MapHistory {
  const before = new Map(mapGeometry(previous).map((item) => [identity(item), item]))
  const after = new Map(mapGeometry(next).map((item) => [identity(item), item]))
  const latest = new Map([...before, ...after])
  const entry: MapHistoryEntry = { before: [], after: [] }
  for (const [key, item] of after) {
    const original = before.get(key)
    if (original && JSON.stringify(original.geometry) !== JSON.stringify(item.geometry)) {
      entry.before.push(original)
      entry.after.push(item)
    } else if (!original && (item.kind === 'camera' || item.kind === 'rig' || item.kind === 'scan')) {
      entry.after.push(item)
    }
  }
  for (const [key, item] of before) {
    if (!after.has(key) && (item.kind === 'camera' || item.kind === 'rig' || item.kind === 'scan')) entry.before.push(item)
  }
  // Keep independent object history and discard a linked image/polygon transform
  // when its object disappears. Lifecycle entries retain earlier camera and rig
  // transforms so undoing a deletion can continue through them.
  const valid = (value: MapHistoryEntry) => value.after.every((item) =>
    item.kind === 'camera' || item.kind === 'rig' || item.kind === 'scan' || after.has(identity(item)))
  const refreshItem = (item: MapGeometry): MapGeometry => {
    const current = latest.get(identity(item))
    if (item.kind === 'camera' && current?.kind === 'camera') {
      return { ...item, index: current.index, angle: cameraWithGeometry(current.angle, item) }
    }
    if (item.kind === 'rig' && current?.kind === 'rig') return { ...item, rig: { ...current.rig, ...item.geometry } }
    return item
  }
  const refresh = (value: MapHistoryEntry): MapHistoryEntry => ({
    before: value.before.map(refreshItem), after: value.after.map(refreshItem),
  })
  const past = history.past.map(refresh).filter(valid)
  const changedObjects = before.size !== after.size || [...before.keys()].some((key) => !after.has(key))
  const changed = entry.before.length > 0 || entry.after.length > 0
  return {
    past: changed ? [...past, entry].slice(-mapHistoryLimit) : past,
    future: changed || changedObjects ? [] : history.future.map(refresh).filter(valid),
  }
}

export function restoreMapHistory(brief: DroneBrief, entry: MapHistoryEntry, direction: 'undo' | 'redo'): DroneBrief {
  let result = brief
  const source = direction === 'undo' ? entry.after : entry.before
  const target = direction === 'undo' ? entry.before : entry.after
  const targetCameraKeys = new Set(target.filter((item) => item.kind === 'camera').map(identity))
  const removedCameraKeys = new Set(source.filter((item) => item.kind === 'camera' && !targetCameraKeys.has(identity(item))).map(identity))
  if (removedCameraKeys.size) result = { ...result, angles: result.angles.filter((angle) => !removedCameraKeys.has(`camera:${angle.id}:${angle.type}`)) }
  for (const item of target.filter((value) => value.kind === 'camera').sort((a, b) => a.index - b.index)) {
    const currentIndex = result.angles.findIndex((angle) => angle.id === item.id && angle.type === item.geometry.type)
    if (currentIndex < 0) {
      const angles = [...result.angles]
      angles.splice(Math.min(item.index, angles.length), 0, item.angle)
      result = { ...result, angles }
      continue
    }
    result = { ...result, angles: result.angles.map((angle, index) => {
      if (index !== currentIndex || angle.type !== item.geometry.type) return angle
      return cameraWithGeometry(angle, item)
    }) }
  }
  const sourceRig = source.find((item) => item.kind === 'rig')
  const targetRig = target.find((item) => item.kind === 'rig')
  if (sourceRig && !targetRig) result = { ...result, circleRig: null }
  if (targetRig) result = { ...result, circleRig: result.circleRig?.id === targetRig.id
    ? { ...result.circleRig, ...targetRig.geometry }
    : targetRig.rig }
  const sourceScan = source.find((item) => item.kind === 'scan')
  const targetScan = target.find((item) => item.kind === 'scan')
  if (sourceScan && !targetScan) result = { ...result, droneScan: null }
  if (targetScan) result = { ...result, droneScan: targetScan.geometry }
  for (const item of target.filter((value) => value.kind === 'image' || value.kind === 'polygon')) {
    switch (item.kind) {
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

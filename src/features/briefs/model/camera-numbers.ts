import { cameraLabels, type CameraAngle, type Position } from './brief'

export function numberedCameras(angles: CameraAngle[]) {
  const counts = { 'drone-image': 0, '360': 0, dslr: 0 }
  return angles.map((angle) => ({ angle, number: ++counts[angle.type] }))
}

export function nextCameraNumber(angles: CameraAngle[], type: CameraAngle['type']) {
  return angles.filter((angle) => angle.type === type).length + 1
}

export function nextCameraLabelNumber(angles: CameraAngle[], type: CameraAngle['type']) {
  let labelNumber = 1
  const labels = new Set(angles.map((angle) => angle.label))
  while (labels.has(cameraLabels[type] + ' ' + labelNumber)) labelNumber++
  return labelNumber
}

export function duplicateCamera(source: CameraAngle, position: Position, id: string, angles: CameraAngle[]): CameraAngle {
  return { ...source, id, label: cameraLabels[source.type] + ' ' + nextCameraLabelNumber(angles, source.type), position }
}

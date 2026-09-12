import type { CameraAngle } from './brief'

export function numberedCameras(angles: CameraAngle[]) {
  const counts = { 'drone-image': 0, '360': 0, dslr: 0 }
  return angles.map((angle) => ({ angle, number: ++counts[angle.type] }))
}

export function nextCameraNumber(angles: CameraAngle[], type: CameraAngle['type']) {
  return angles.filter((angle) => angle.type === type).length + 1
}

import type { CameraAngle, LayerVisibility } from '@/features/briefs/model/brief'
import type { CaptureKind } from '@/features/briefs/components/capture-kind-glyph'

export type IsolatedCapture = CaptureKind | null

export function toggleIsolatedCapture(current: IsolatedCapture, kind: CaptureKind): IsolatedCapture {
  return current === kind ? null : kind
}

export function isolatedCaptureVisibility(visibility: LayerVisibility, isolated: IsolatedCapture): Pick<LayerVisibility, 'circleRig' | 'angles' | 'droneScan'> {
  const showAngles = isolated == null || (isolated !== 'circleRig' && isolated !== 'droneScan')
  return {
    circleRig: visibility.circleRig && (isolated == null || isolated === 'circleRig'),
    angles: visibility.angles && showAngles,
    droneScan: visibility.droneScan && (isolated == null || isolated === 'droneScan'),
  }
}

export function isolatedCaptureAngles(angles: CameraAngle[], isolated: IsolatedCapture) {
  if (isolated == null) return angles
  if (isolated === 'circleRig' || isolated === 'droneScan') return []
  return angles.filter((angle) => angle.type === isolated)
}

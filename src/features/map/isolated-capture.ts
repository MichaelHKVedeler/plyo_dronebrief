import { defaultVisibility, type CameraAngle, type LayerVisibility } from '@/features/briefs/model/brief'
import type { CaptureKind } from '@/features/briefs/components/capture-kind-glyph'

export type IsolatedCapture = CaptureKind | null

export function toggleIsolatedCapture(current: IsolatedCapture, kind: CaptureKind): IsolatedCapture {
  return current === kind ? null : kind
}

export function isolatedCaptureVisibility(visibility: LayerVisibility, isolated: IsolatedCapture, briefing = false): Pick<LayerVisibility, 'circleRig' | 'angles' | 'droneScan'> {
  const showScan = visibility.droneScan && (isolated === 'droneScan' || (!briefing && isolated == null))
  const showAngles = visibility.angles && (isolated == null || (isolated !== 'circleRig' && isolated !== 'droneScan'))
  return {
    circleRig: visibility.circleRig && (isolated == null || isolated === 'circleRig'),
    angles: showAngles || showScan,
    droneScan: showScan,
  }
}

export function isolatedCaptureAngles(angles: CameraAngle[], isolated: IsolatedCapture, briefing = false, visibility = defaultVisibility) {
  return angles.filter((angle) => {
    if (angle.type === 'extra-coverage') {
      return visibility.droneScan && (isolated === 'droneScan' || (!briefing && isolated == null))
    }
    return visibility.angles && (isolated == null || angle.type === isolated)
  })
}

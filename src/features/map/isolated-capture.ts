import { defaultVisibility, type CameraAngle, type LayerVisibility } from '@/features/briefs/model/brief'
import type { CaptureKind } from '@/features/briefs/components/capture-kind-glyph'

/** `droneScan` shows circles with extra coverage; `scanCircles` and `extra-coverage` split them for drone scan links. */
export type IsolatedCapture = CaptureKind | 'scanCircles' | null

export function toggleIsolatedCapture<T extends IsolatedCapture>(current: T | null, kind: T): T | null {
  return current === kind ? null : kind
}

function showsScanGroup(isolated: IsolatedCapture, briefing: boolean) {
  return isolated === 'droneScan' || (!briefing && isolated == null)
}

export function isolatedCaptureVisibility(visibility: LayerVisibility, isolated: IsolatedCapture, briefing = false): Pick<LayerVisibility, 'circleRig' | 'angles' | 'droneScan'> {
  const showScan = visibility.droneScan && (showsScanGroup(isolated, briefing) || isolated === 'scanCircles')
  const showExtra = visibility.droneScan && (showsScanGroup(isolated, briefing) || isolated === 'extra-coverage')
  const showAngles = visibility.angles && (isolated == null || (isolated !== 'circleRig' && isolated !== 'droneScan' && isolated !== 'scanCircles' && isolated !== 'extra-coverage'))
  return {
    circleRig: visibility.circleRig && (isolated == null || isolated === 'circleRig'),
    angles: showAngles || showExtra,
    droneScan: showScan,
  }
}

export function isolatedCaptureAngles(angles: CameraAngle[], isolated: IsolatedCapture, briefing = false, visibility = defaultVisibility) {
  return angles.filter((angle) => {
    if (angle.type === 'extra-coverage') {
      return visibility.droneScan && (showsScanGroup(isolated, briefing) || isolated === 'extra-coverage')
    }
    return visibility.angles && (isolated == null || angle.type === isolated)
  })
}

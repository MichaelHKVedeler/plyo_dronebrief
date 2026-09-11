import { cameraLabels, type CameraAngle, type Position } from '@/features/briefs/model/brief'
import { bearingDegrees, distanceMeters } from './geometry'

export type CameraType = CameraAngle['type']
export type MapTool =
  | { kind: 'idle' }
  | { kind: 'camera'; cameraType: CameraType; position: Position | null; directionDegrees: number }

export const idleTool: MapTool = { kind: 'idle' }
export function startCameraPlacement(cameraType: CameraType): MapTool {
  return { kind: 'camera', cameraType, position: null, directionDegrees: 0 }
}
export function aimPlacement(tool: MapTool, point: Position): MapTool {
  if (tool.kind !== 'camera' || !tool.position || tool.cameraType === '360') return tool
  if (distanceMeters(tool.position, point) < 0.01) return tool
  return { ...tool, directionDegrees: distanceMeters(tool.position, point) < 0.01 ? tool.directionDegrees : bearingDegrees(tool.position, point) }
}
export function placeCamera(tool: MapTool, point: Position, id: string, labelNumber: number): { tool: MapTool; angle?: CameraAngle } {
  if (tool.kind !== 'camera') return { tool }
  const base = { id, label: cameraLabels[tool.cameraType] + ' ' + labelNumber, position: tool.position ?? point }
  if (tool.cameraType === '360') return { tool: startCameraPlacement(tool.cameraType), angle: { ...base, type: '360' } }
  if (!tool.position) return { tool: { ...tool, position: point } }

  return { tool: startCameraPlacement(tool.cameraType), angle: { ...base, type: tool.cameraType, directionDegrees: distanceMeters(tool.position, point) < 0.01 ? tool.directionDegrees : bearingDegrees(tool.position, point) } }
}
export function placementHint(tool: MapTool): string | null {
  if (tool.kind === 'camera') return tool.position
    ? 'Drag to aim, then release to place. Right-click or Esc stops placement.'
    : (tool.cameraType === '360' ? 'Click to place a 360 point. ' : 'Press and drag to place and aim a camera. ') + 'Keep placing points; right-click or Esc stops.'
  return null
}

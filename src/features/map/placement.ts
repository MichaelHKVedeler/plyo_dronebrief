import { cameraLabels, type CameraAngle, type Position } from '@/features/briefs/model/brief'
import { bearingDegrees, distanceMeters } from './geometry'

export type CameraType = CameraAngle['type']
export type MapTool =
  | { kind: 'idle' }
  | { kind: 'project' }
  | { kind: 'camera'; cameraType: CameraType; position: Position | null; directionDegrees: number }

export const idleTool: MapTool = { kind: 'idle' }
export function startCameraPlacement(cameraType: CameraType): MapTool {
  return { kind: 'camera', cameraType, position: null, directionDegrees: 0 }
}
export function aimPlacement(tool: MapTool, point: Position): MapTool {
  if (tool.kind !== 'camera' || !tool.position || tool.cameraType === '360') return tool
  if (distanceMeters(tool.position, point) < 0.01) return tool
  return { ...tool, directionDegrees: bearingDegrees(tool.position, point) }
}
export function placeCamera(tool: MapTool, point: Position, id: string, labelNumber: number): { tool: MapTool; angle?: CameraAngle } {
  if (tool.kind !== 'camera') return { tool }
  const base = { id, label: cameraLabels[tool.cameraType] + ' ' + labelNumber, position: tool.position ?? point }
  if (tool.cameraType === '360') return { tool: idleTool, angle: { ...base, type: '360' } }
  if (!tool.position) return { tool: { ...tool, position: point } }
  if (distanceMeters(tool.position, point) < 0.01) return { tool }
  return { tool: idleTool, angle: { ...base, type: tool.cameraType, directionDegrees: bearingDegrees(tool.position, point) } }
}
export function placementHint(tool: MapTool): string | null {
  if (tool.kind === 'project') return 'Click the map to set the project location.'
  if (tool.kind === 'camera') return tool.position
    ? 'Click where the camera should point. Escape cancels.'
    : 'Click the map to place a ' + cameraLabels[tool.cameraType] + ' point. Escape cancels.'
  return null
}

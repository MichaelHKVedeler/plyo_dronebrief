import type { DroneBrief, Position } from '@/features/briefs/model/brief'

// Small-area approximation for the initial rig preview. Replace with geodesic
// editing before adding surveying-grade or polar-region workflows.
export function rigOutline(rig: NonNullable<DroneBrief['circleRig']>): Position[] {
  const rotation = rig.rotationDegrees * Math.PI / 180
  const longitudeScale = 111320 * Math.max(0.01, Math.cos(rig.position.lat * Math.PI / 180))
  return Array.from({ length: 64 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2
    const east = Math.sin(angle) * rig.radiusMeters * rig.ovalRatio
    const north = Math.cos(angle) * rig.radiusMeters
    return {
      lat: Math.max(-90, Math.min(90, rig.position.lat + (north * Math.cos(rotation) - east * Math.sin(rotation)) / 111320)),
      lng: ((rig.position.lng + (east * Math.cos(rotation) + north * Math.sin(rotation)) / longitudeScale + 540) % 360) - 180,
    }
  })
}

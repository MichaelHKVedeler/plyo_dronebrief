import type { DroneBrief } from '@/features/briefs/model/brief'

export const cameraDirectionRadiusPixels = 40

export function cameraDirectionLayout(settings?: Pick<DroneBrief['typeSettings']['dslr'], 'angleCount' | 'spacingDegrees'>) {
  const count = settings?.angleCount ?? 1
  const spacing = settings?.spacingDegrees ?? 30
  const offsets = Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * spacing)
  return { offsets, radiusPixels: cameraDirectionRadiusPixels }
}

export function cameraArrowOffset(headingDegrees: number, radiusPixels = cameraDirectionRadiusPixels) {
  const heading = headingDegrees * Math.PI / 180
  return { x: Math.sin(heading) * radiusPixels, y: -Math.cos(heading) * radiusPixels }
}

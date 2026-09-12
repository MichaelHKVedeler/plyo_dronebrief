import type { DroneBrief } from '@/features/briefs/model/brief'

export function cameraDirectionLayout(settings?: Pick<DroneBrief['typeSettings']['dslr'], 'angleCount' | 'spacingDegrees'>) {
  const count = settings?.angleCount ?? 1
  const spacing = settings?.spacingDegrees ?? 30
  const offsets = Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * spacing)
  const radiusPixels = 40
  return { offsets, radiusPixels }
}

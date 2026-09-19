import type { PanoramaFocus } from '@/features/briefs/model/brief'

export function PanoramaFocusCone({ focus, color }: { focus: PanoramaFocus; color: string }) {
  const half = focus.fovDegrees * Math.PI / 360
  const radius = 50
  const x = radius * Math.sin(half), y = -radius * Math.cos(half)
  return <svg data-panorama-focus aria-label={`360 focus: ${focus.fovDegrees}° field of view, heading ${focus.directionDegrees}°`}
    className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible" width="120" height="120" viewBox="-60 -60 120 120"
    style={{ transform: 'translate(-50%, -50%)', color }}>
    <g transform={`rotate(${focus.directionDegrees})`}>
      <path d={`M 0 0 L ${-x} ${y} A ${radius} ${radius} 0 0 1 ${x} ${y} Z`} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />
      <path d={`M 0 -22 L 0 ${-radius}`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
    </g>
  </svg>
}

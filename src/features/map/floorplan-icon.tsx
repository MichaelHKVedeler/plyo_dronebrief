import type { SVGProps } from 'react'

/** Lucide has no floor plan glyph: a sheet with a folded corner and an L-shaped plan, in Lucide's 24px style. */
export function FloorplanIcon(props: SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7 3h14v18H3V7z" />
    <path d="M3 7h4V3" />
    <path d="M13 7h5v11H6v-6h7z" />
    <path d="M9.5 12v3" />
    <path d="M18 14.5h-2.5" />
  </svg>
}

import type { SVGProps } from 'react'

/** Lucide has no floor plan glyph: an L-shaped plan with two inner walls, in Lucide's 24px style. */
export function FloorplanIcon(props: SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 3h9v18H3v-9h9z" />
    <path d="M7.5 12v4.5" />
    <path d="M21 15h-4" />
  </svg>
}

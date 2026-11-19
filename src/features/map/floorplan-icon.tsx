import type { SVGProps } from 'react'

/** Lucide has no floor plan glyph; this one follows its 24px, 2px-stroke style. */
export function FloorplanIcon(props: SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 3h18v18H3z" />
    <path d="M12 3v6" />
    <path d="M12 13v8" />
    <path d="M3 12h5" />
    <path d="M16 12h5" />
  </svg>
}

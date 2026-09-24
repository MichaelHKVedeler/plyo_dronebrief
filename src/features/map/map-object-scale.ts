import { createContext, useContext } from 'react'

// The slider shows 0–100%. Rendering units stay on the original map scale:
// 50% (the standard size) is 60 units, and 100% is 120. Share URLs store rendering units.
export const overlayDisplayScale = 1.2
export const defaultOverlaySize = 60

export function overlayRenderingSize(displayPercent: number) {
  return displayPercent * overlayDisplayScale
}

export function overlayDisplayPercent(renderingSize: number) {
  return Math.round(renderingSize / overlayDisplayScale)
}

// Preserve the original symbol sizes at Google zoom 17. Each zoom step doubles
// both map geometry and symbols, including fractional zoom and zooming far out.
// `sizePercent` is rendering units, not the slider label. Callers that omit it
// keep the original symbol size (100 rendering units).
export function mapObjectScale(googleZoom: number, sizePercent = 100): number {
  return 2 ** (googleZoom - 17) * sizePercent / 100
}

// Providers supply the same Google-equivalent scale; this is view state only.
export const MapObjectScale = createContext(1)
export const useMapObjectScale = () => useContext(MapObjectScale)

import { createContext, useContext } from 'react'

// Preserve the original symbol sizes at Google zoom 17. Each zoom step doubles
// both map geometry and symbols, including fractional zoom and zooming far out.
export function mapObjectScale(googleZoom: number, sizePercent = 100): number {
  return 2 ** (googleZoom - 17) * sizePercent / 100
}

// Providers supply the same Google-equivalent scale; this is view state only.
export const MapObjectScale = createContext(1)
export const useMapObjectScale = () => useContext(MapObjectScale)

import { createContext } from 'react'
import type { Map } from 'maplibre-gl'

export const ShadeProjection = createContext<Map | null>(null)

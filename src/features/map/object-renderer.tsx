import { createContext, useContext, type ComponentType, type RefAttributes } from 'react'
import { AdvancedMarker, Polygon, type AdvancedMarkerProps } from '@vis.gl/react-google-maps'

// Object controls and editing rules are shared; providers only place geometry.
export type ObjectMarkerProps = AdvancedMarkerProps & { onDragCancel?: () => void }
export const ObjectRenderer = createContext<{ Marker: ComponentType<ObjectMarkerProps & RefAttributes<google.maps.marker.AdvancedMarkerElement>>; Polygon: typeof Polygon }>({ Marker: AdvancedMarker, Polygon })
export const useObjectRenderer = () => useContext(ObjectRenderer)

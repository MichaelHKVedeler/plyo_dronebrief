// Both renderers expose the same small navigation surface to the shared controls.
export type MapNavigation = Pick<google.maps.Map, 'getDiv' | 'getZoom' | 'setZoom' | 'panTo' | 'fitBounds' | 'moveCamera'> & {
  getBounds: () => google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | undefined
  waitForIdle?: (signal: AbortSignal) => Promise<void>
}

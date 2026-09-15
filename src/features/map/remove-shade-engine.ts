/** ShadeMap.remove() reads MapLibre `style.getLayer`. That style is already gone after a partial load or MapLibre teardown. */
export function removeShadeEngine(engine: { remove: () => void } | null | undefined) {
  try { engine?.remove() } catch { /* SDK teardown is unsafe once the map style is missing. */ }
}

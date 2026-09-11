import { useEffect, useRef, useState } from 'react'

// Keep handles reachable when the pointer crosses the gap outside an object.
export function useHoverHandles(frozen = false) {
  const [hovered, setHovered] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function enter() {
    if (frozen) return
    if (timer.current) clearTimeout(timer.current)
    setHovered(true)
  }
  function leave() {
    if (frozen) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHovered(false), 450)
  }
  useEffect(() => {
    if (frozen && timer.current) clearTimeout(timer.current)
  }, [frozen])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { hovered, enter, leave }
}

import { useEffect, useRef, useState } from 'react'

// Keep handles reachable when the pointer crosses the gap outside an object.
export function useHoverHandles() {
  const [hovered, setHovered] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function enter() {
    if (timer.current) clearTimeout(timer.current)
    setHovered(true)
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHovered(false), 450)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { hovered, enter, leave }
}

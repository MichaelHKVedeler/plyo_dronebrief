import { useEffect, useRef, useState } from 'react'

// Keep handles reachable when the pointer crosses the gap outside an object.
export function useHoverHandles(frozen = false, leaveDelay = 450) {
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
    if (leaveDelay === 0) setHovered(false)
    else timer.current = setTimeout(() => setHovered(false), leaveDelay)
  }
  useEffect(() => {
    if (frozen && timer.current) clearTimeout(timer.current)
  }, [frozen])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { hovered, enter, leave }
}

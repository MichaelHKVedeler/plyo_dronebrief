import { useLayoutEffect, useRef } from 'react'
import type { BriefAction, BriefSession } from './brief-session'

export function useMapHistoryShortcuts(session: BriefSession, dispatch: (action: BriefAction) => void) {
  const latestDispatch = useRef(dispatch)
  useLayoutEffect(() => { latestDispatch.current = dispatch }, [dispatch])
  // Install before the map's gesture effects and retain listener order across
  // previews: those controllers can stop immediate propagation on release.
  useLayoutEffect(() => {
    if (session.mode !== 'edit') return
    const pointers = new Set<number>()
    const down = (event: PointerEvent) => { pointers.add(event.pointerId) }
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId) }
    const blur = () => pointers.clear()
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return
      const letter = event.key.toLowerCase()
      const direction = letter === 'z' ? (event.shiftKey ? 'redo' : 'undo') : letter === 'y' && !event.shiftKey ? 'redo' : null
      if (!direction) return
      // Leave browser text undo and modal interactions alone, including search.
      if (event.composedPath().some((target) => target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="dialog"], [role="alertdialog"]')))) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      event.preventDefault()
      // A pending drag still owns its preview; only released gestures enter history.
      if (event.repeat || pointers.size) return
      latestDispatch.current({ type: 'update', history: direction })
    }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('blur', blur)
    }
  }, [session.mode])
}

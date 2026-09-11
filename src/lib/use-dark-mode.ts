import { useSyncExternalStore } from 'react'

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}
// Follow the resolved app theme, including manual overrides and OS changes.
export function useDarkMode() {
  return useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'), () => false)
}

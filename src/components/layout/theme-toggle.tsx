import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'system' | 'light' | 'dark'
const storageKey = 'dronebrief:theme'
const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'light' || value === 'dark') return value
  } catch { /* System preference also works when browser storage is unavailable. */ }
  return 'system'
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!media?.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    media?.addEventListener('change', apply)
    const sync = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) setTheme(readTheme()) }
    window.addEventListener('storage', sync)
    return () => { media?.removeEventListener('change', apply); window.removeEventListener('storage', sync) }
  }, [theme])
  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun
  const label = `Theme: ${theme}. Switch to ${nextTheme[theme]}`
  return <Button className={className} variant="ghost" size="icon" title={label} aria-label={label} onClick={() => {
    const next = nextTheme[theme]
    setTheme(next)
    try { if (next === 'system') localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, next) } catch { /* Keep the choice for this session. */ }
  }}><Icon className="size-4" /></Button>
}

import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export function AppHeader({ onHome, context, children }: { onHome: () => void; context?: ReactNode; children?: ReactNode }) {
  return <header className="shrink-0 border-b bg-card px-3 py-2 sm:px-4">
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="flex items-center gap-2">
      <Button variant="ghost" className="gap-3 px-0 text-base text-foreground hover:bg-transparent" onClick={onHome} aria-label="Dronebrief home">
        <img src="/brand/plyo-logo-light.svg" alt="Plyo" className="h-5 w-auto dark:hidden" width="69" height="20" />
        <img src="/brand/plyo-logo-dark.svg" alt="Plyo" className="hidden h-5 w-auto dark:block" width="69" height="20" />
        <span>Dronebrief</span>
      </Button>
      <ThemeToggle />
      </div>
      {context && <div className="min-w-0">{context}</div>}
      {children && <div className="flex flex-wrap items-center gap-2 sm:col-span-2 sm:justify-end lg:col-span-1">{children}</div>}
    </div>
  </header>
}

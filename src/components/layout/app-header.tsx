import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export function AppHeader({ onHome, children }: { onHome: () => void; children?: ReactNode }) {
  return <header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6">
    <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3">
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
      <Button variant="ghost" className="gap-3 px-0 text-base text-foreground hover:bg-transparent" onClick={onHome} aria-label="Dronebrief home">
        <img src="/brand/plyo-logo-light.svg" alt="Plyo" className="h-5 w-auto dark:hidden" width="69" height="20" />
        <img src="/brand/plyo-logo-dark.svg" alt="Plyo" className="hidden h-5 w-auto dark:block" width="69" height="20" />
        <span>Dronebrief</span>
      </Button>
      <ThemeToggle />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  </header>
}

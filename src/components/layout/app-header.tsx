import { Drone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export function AppHeader({ onHome, children }: { onHome: () => void; children?: ReactNode }) {
  return <header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6">
    <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" className="px-0 text-base text-primary hover:bg-transparent" onClick={onHome} aria-label="Dronebrief home">
        <Drone className="size-6" /> Dronebrief
      </Button>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </header>
}

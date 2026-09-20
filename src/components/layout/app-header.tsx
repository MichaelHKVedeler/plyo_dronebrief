import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

function BrandMark() {
  return <>
    <img
      src={`${import.meta.env.BASE_URL}brand/plyo-logo-light.svg`}
      alt="Plyo"
      className="h-5 w-auto dark:hidden"
      width="69"
      height="20"
    />
    <img
      src={`${import.meta.env.BASE_URL}brand/plyo-logo-dark.svg`}
      alt="Plyo"
      className="hidden h-5 w-auto dark:block"
      width="69"
      height="20"
    />
    <span>Dronebrief</span>
  </>
}

export function AppHeader({
  onHome,
  status,
  context,
  children,
  align = 'page',
}: {
  onHome?: () => void
  status?: ReactNode
  context?: ReactNode
  children?: ReactNode
  align?: 'page' | 'map'
}) {
  const brand = <div className="flex shrink-0 items-center gap-2">
    {onHome ? <Button
      variant="ghost"
      className="gap-3 px-0 text-base text-foreground hover:bg-transparent"
      onClick={onHome}
      aria-label="Dronebrief home"
    >
      <BrandMark />
    </Button> : <div className="flex items-center gap-3 text-base text-foreground">
      <BrandMark />
    </div>}
    <ThemeToggle />
    {status}
  </div>
  if (align === 'map') {
    return <header className="shrink-0 border-b bg-card px-3 py-2 sm:px-4">
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,max-content)_minmax(0,1fr)] items-center gap-x-3">
          <div className="z-10 justify-self-start">{brand}</div>
          {context && <div className="min-w-0 max-w-full justify-self-center">{context}</div>}
          <div />
        </div>
        {children && <div className="hidden justify-self-end lg:flex lg:flex-nowrap lg:items-center lg:gap-2">{children}</div>}
      </div>
    </header>
  }
  return (
    <header className="shrink-0 border-b bg-card px-3 py-2 sm:px-4">
      <div className={context
        ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3'
        : 'flex items-center justify-between gap-2'}>
        {brand}
        {context && <div className="w-fit max-w-full justify-self-center">{context}</div>}
        {children && (
          <div className={`flex shrink-0 flex-nowrap items-center gap-2 ${context ? 'justify-self-end' : ''}`}>
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

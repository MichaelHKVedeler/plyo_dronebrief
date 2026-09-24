import { useSyncExternalStore, type ReactNode } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

const desktopQuery = '(min-width: 1024px)'
function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(desktopQuery)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const isDesktop = () => window.matchMedia?.(desktopQuery).matches ?? false
// Wide enough for the camera center and remove buttons to stay inside the sidebar.
const sidebarMinPx = 400

export function ResizableWorkspace({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false)
  return <ResizablePanelGroup orientation={desktop ? 'horizontal' : 'vertical'} disabled={!desktop}
    className="min-h-[852px] flex-1 gap-3 lg:min-h-0 lg:gap-0">
    <ResizablePanel id="workspace-map" minSize={desktop ? 400 : 480}>
      {children}
    </ResizablePanel>
    <ResizableHandle aria-label="Resize details sidebar" title="Drag or use arrow keys to resize the sidebar"
      className="hidden w-3 bg-transparent after:w-px after:bg-border hover:after:bg-primary focus-visible:after:bg-primary lg:flex" />
    <ResizablePanel id="workspace-details" defaultSize={sidebarMinPx} minSize={desktop ? sidebarMinPx : 360}
      maxSize={desktop ? '50%' : undefined} groupResizeBehavior="preserve-pixel-size">
      {sidebar}
    </ResizablePanel>
  </ResizablePanelGroup>
}

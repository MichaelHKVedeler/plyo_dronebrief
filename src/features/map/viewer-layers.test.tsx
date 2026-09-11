import { useEffect, useState } from 'react'
import { expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '@/features/briefs/model/brief'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'
import { LayersPanel } from '@/features/briefs/components/layers-panel'
import { ViewerLayers } from './viewer-layers'

it('shares visibility state with the sidebar without changing a read-only brief', async () => {
  const brief = createBrief({ name: 'Viewer', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
  let current = openSession(brief, 'view')
  function Fixture() {
    const [session, setSession] = useState(current)
    useEffect(() => { current = session }, [session])
    return <><div data-testid="overlay"><ViewerLayers session={session} dispatch={(action) => setSession((s) => reduceSession(s, action))} /></div>
      <div data-testid="sidebar"><LayersPanel session={session} onToggle={(layer, visible) => setSession((s) => reduceSession(s, { type: 'visibility', layer, visible }))} /></div></>
  }
  const user = userEvent.setup(); const view = render(<Fixture />)
  await user.click(within(view.getByTestId('overlay')).getByRole('switch', { name: 'Circle rig' }))
  expect(within(view.getByTestId('sidebar')).getByRole('switch', { name: 'Circle rig' })).toHaveAttribute('aria-checked', 'false')
  await user.click(within(view.getByTestId('sidebar')).getByRole('switch', { name: 'Camera angles' }))
  expect(within(view.getByTestId('overlay')).getByRole('switch', { name: 'Additional angles' })).toHaveAttribute('aria-checked', 'false')
  expect(current.brief).toBe(brief)
  expect(current.mode).toBe('view')
  view.unmount()
})

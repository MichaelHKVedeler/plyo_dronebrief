import { useEffect, useState } from 'react'
import { expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrief } from '@/features/briefs/model/brief'
import { openSession, reduceSession } from '@/features/briefs/state/brief-session'
import { ViewerLayers } from './viewer-layers'

it('toggles map layer visibility without changing a read-only brief', async () => {
  const brief = createBrief({ name: 'Viewer', clientName: 'Test', date: '2026-09-11', times: ['09:00'] })
  let current = openSession(brief, 'view')
  function Fixture() {
    const [session, setSession] = useState(current)
    useEffect(() => { current = session }, [session])
    return <div data-testid="overlay"><ViewerLayers session={session} dispatch={(action) => setSession((s) => reduceSession(s, action))} /></div>
  }
  const user = userEvent.setup(); const view = render(<Fixture />)
  const overlay = view.getByTestId('overlay')
  await user.click(within(overlay).getByRole('switch', { name: 'Circle rig' }))
  expect(current.visibility.circleRig).toBe(false)
  await user.click(within(overlay).getByRole('switch', { name: 'Additional angles' }))
  expect(current.visibility.angles).toBe(false)
  await user.click(within(overlay).getByRole('switch', { name: 'Image overlays' }))
  expect(current.visibility.imageOverlays).toBe(false)
  expect(current.brief).toBe(brief)
  expect(current.mode).toBe('view')
  view.unmount()
})

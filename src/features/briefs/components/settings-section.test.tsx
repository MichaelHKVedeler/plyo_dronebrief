import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'

it('toggles visibility without collapsing the section', async () => {
  const onToggle = vi.fn()
  const user = userEvent.setup()
  render(<Accordion type="multiple" defaultValue={['rig']}>
    <SettingsSection value="rig" title="Circle rig" visibility={{ visible: true, onToggle }}>
      <p>Rig controls</p>
    </SettingsSection>
  </Accordion>)

  await user.click(screen.getByRole('button', { name: 'Hide Circle rig' }))

  expect(onToggle).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Circle rig' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Rig controls')).toBeVisible()
})

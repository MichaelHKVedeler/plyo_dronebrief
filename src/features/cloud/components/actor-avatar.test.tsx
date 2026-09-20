import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActorAvatar } from './actor-avatar'

it('exposes the actor in an avatar and shows name and timestamp on hover', async () => {
  const at = '2026-09-20T06:29:00.000Z'
  render(<ActorAvatar label="Created by" actor={{ uid: 'owner', name: 'Ada Lovelace' }} at={at} />)
  const trigger = screen.getByRole('button', { name: `Created by Ada Lovelace · ${new Date(at).toLocaleString()}` })
  expect(trigger).toHaveTextContent('AL')
  await userEvent.hover(trigger)
  const tooltip = await screen.findByRole('tooltip')
  expect(tooltip).toHaveTextContent('Ada Lovelace')
  expect(tooltip).toHaveTextContent(new Date(at).toLocaleString())
})

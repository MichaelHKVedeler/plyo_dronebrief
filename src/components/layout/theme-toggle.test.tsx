import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './theme-toggle'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.classList.remove('dark') })
it('follows system changes until overridden, remembers the choice, and can return to system', async () => {
  localStorage.clear()
  let changed = () => {}
  const media = { matches: true, addEventListener: (_: string, fn: () => void) => { changed = fn }, removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', () => media)
  const user = userEvent.setup()
  const app = render(<ThemeToggle />)
  expect(document.documentElement).toHaveClass('dark')
  act(() => { media.matches = false; changed() })
  expect(document.documentElement).not.toHaveClass('dark')
  await user.click(screen.getByRole('button', { name: 'Theme: system. Switch to light' }))
  act(() => { media.matches = true; changed() })
  expect(document.documentElement).not.toHaveClass('dark')
  await user.click(screen.getByRole('button', { name: 'Theme: light. Switch to dark' }))
  expect(localStorage.getItem('dronebrief:theme')).toBe('dark')
  app.unmount(); render(<ThemeToggle />)
  expect(document.documentElement).toHaveClass('dark')
  await user.click(screen.getByRole('button', { name: 'Theme: dark. Switch to system' }))
  expect(localStorage.getItem('dronebrief:theme')).toBeNull()
  act(() => { media.matches = false; changed() })
  expect(document.documentElement).not.toHaveClass('dark')
})
it('allows changing appearance when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable') })
  const user = userEvent.setup(); render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: 'Theme: system. Switch to light' }))
  await user.click(screen.getByRole('button', { name: 'Theme: light. Switch to dark' }))
  expect(document.documentElement).toHaveClass('dark')
})

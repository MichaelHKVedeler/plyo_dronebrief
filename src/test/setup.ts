import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom has no layout engine. Real scrolling and resizing are checked in-browser.
vi.stubGlobal('ResizeObserver', class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
})

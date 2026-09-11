import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom has no layout engine; slider keyboard tests only need the observer API.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

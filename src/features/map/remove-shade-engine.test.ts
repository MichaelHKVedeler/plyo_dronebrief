import { expect, it, vi } from 'vitest'
import { removeShadeEngine } from './remove-shade-engine'

it('removes a live engine and ignores teardown that reads a missing MapLibre style', () => {
  const remove = vi.fn()
  removeShadeEngine({ remove })
  expect(remove).toHaveBeenCalledOnce()
  expect(() => removeShadeEngine({ remove: () => { throw new TypeError("Cannot read properties of undefined (reading 'getLayer')") } })).not.toThrow()
  expect(() => removeShadeEngine(null)).not.toThrow()
})

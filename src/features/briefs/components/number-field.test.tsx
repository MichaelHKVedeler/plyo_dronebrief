import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NumberField } from './number-field'

it('resets to the default only when right-clicking the spinner-arrow area', () => {
  const changed = vi.fn()
  function Fixture() {
    const [value, setValue] = useState(7)
    return <NumberField label="Count" value={value} min={1} max={20} resetValue={10} onChange={(next) => { changed(next); setValue(next) }} />
  }
  render(<Fixture />)
  const input = screen.getByRole('spinbutton', { name: 'Count' })
  vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 40, width: 200, height: 40, toJSON: () => ({}) })

  fireEvent.contextMenu(input, { clientX: 100, clientY: 20 })
  expect(changed).not.toHaveBeenCalled()
  expect(input).toHaveValue(7)

  fireEvent.contextMenu(input, { clientX: 190, clientY: 20 })
  expect(changed).toHaveBeenCalledWith(10)
  expect(input).toHaveValue(10)
})

it('uses the spinner initial value when no fixed reset value is provided', () => {
  function Fixture() {
    const [value, setValue] = useState(125)
    return <><button onClick={() => setValue(200)}>Change</button><NumberField label="Radius" value={value} min={1} max={1000} onChange={setValue} /></>
  }
  render(<Fixture />)
  const input = screen.getByRole('spinbutton', { name: 'Radius' })
  vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 40, width: 200, height: 40, toJSON: () => ({}) })
  fireEvent.click(screen.getByRole('button', { name: 'Change' }))
  expect(input).toHaveValue(200)
  fireEvent.contextMenu(input, { clientX: 190, clientY: 20 })
  expect(input).toHaveValue(125)
})

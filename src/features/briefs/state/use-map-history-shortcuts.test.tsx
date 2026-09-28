import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createBrief, type BriefMode } from '../model/brief'
import { openSession, type BriefAction } from './brief-session'
import { useMapHistoryShortcuts } from './use-map-history-shortcuts'

afterEach(cleanup)
function Editor({ mode = 'edit', dispatch }: { mode?: BriefMode; dispatch: (action: BriefAction) => void }) {
  useMapHistoryShortcuts(openSession(createBrief({ name: 'Keyboard', clientName: 'Test' }), mode), dispatch)
  return <><input aria-label="Name" /><textarea aria-label="Notes" /><div contentEditable suppressContentEditableWarning><span>Editable</span></div><button>Map object</button></>
}

it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z on map controls', () => {
  const dispatch = vi.fn()
  render(<Editor dispatch={dispatch} />)
  for (const modifier of ['ctrlKey', 'metaKey']) {
    fireEvent.keyDown(screen.getByRole('button'), { key: 'z', [modifier]: true })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'update', history: 'undo' })
    fireEvent.keyDown(window, { key: 'y', [modifier]: true })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'update', history: 'redo' })
    fireEvent.keyDown(window, { key: 'Z', shiftKey: true, [modifier]: true })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'update', history: 'redo' })
  }
  expect(dispatch).toHaveBeenCalledTimes(6)
})

it('preserves native text undo and ignores dialogs, composition, modifiers and read-only mode', () => {
  const dispatch = vi.fn()
  const app = render(<Editor dispatch={dispatch} />)
  for (const target of [screen.getByLabelText('Name'), screen.getByLabelText('Notes'), screen.getByText('Editable')]) {
    expect(fireEvent.keyDown(target, { key: 'z', ctrlKey: true })).toBe(true)
  }
  for (const options of [{}, { ctrlKey: true, altKey: true }, { ctrlKey: true, isComposing: true }, { ctrlKey: true, repeat: true }]) fireEvent.keyDown(window, { key: 'z', ...options })
  const modal = document.createElement('div'); modal.setAttribute('role', 'dialog'); document.body.append(modal)
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); modal.remove()
  app.rerender(<Editor dispatch={dispatch} mode="view" />)
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
  expect(dispatch).not.toHaveBeenCalled()
})

it('waits for gesture release across rerenders and clears cancelled pointers', () => {
  const dispatch = vi.fn()
  const app = render(<Editor dispatch={dispatch} />)
  fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 1 })
  const gestureRelease = (event: Event) => event.stopImmediatePropagation()
  window.addEventListener('pointerup', gestureRelease, true)
  app.rerender(<Editor dispatch={(action) => dispatch(action)} />)
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(dispatch).not.toHaveBeenCalled()
  fireEvent.pointerUp(window, { pointerId: 1 })
  window.removeEventListener('pointerup', gestureRelease, true)
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(dispatch).toHaveBeenCalledOnce()
  fireEvent.pointerDown(window, { pointerId: 2 }); fireEvent.pointerCancel(window, { pointerId: 2 })
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(dispatch).toHaveBeenCalledTimes(2)
  fireEvent.pointerDown(window, { pointerId: 3 }); fireEvent.blur(window)
  fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
  expect(dispatch).toHaveBeenCalledTimes(3)
  app.unmount()
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(dispatch).toHaveBeenCalledTimes(3)
})

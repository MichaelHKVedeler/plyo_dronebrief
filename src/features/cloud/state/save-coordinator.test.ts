import { expect, it, vi } from 'vitest'
import { createBrief } from '@/features/briefs/model/brief'
import type { ProjectSummary } from '../model/cloud'
import { SaveCoordinator } from './save-coordinator'

const brief = createBrief({ name: 'Test', clientName: 'Client' })
const summary = (revision: number) => ({ revision } as ProjectSummary)
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { promise, resolve } }
it('serializes saves, coalesces pending edits and only acknowledges committed revisions', async () => {
  const first = deferred<ProjectSummary>(); const second = deferred<ProjectSummary>()
  const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const changed = vi.fn(); const coordinator = new SaveCoordinator(1, save, changed)
  coordinator.enqueue(brief, {}); coordinator.enqueue({ ...brief, project: { ...brief.project, name: 'Next' } }, {})
  expect(save).toHaveBeenCalledTimes(1); expect(coordinator.status).toBe('Saving'); expect(coordinator.dirty).toBe(true)
  first.resolve(summary(2)); await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][0].expectedRevision).toBe(2)
  expect(save.mock.calls[1][0].brief.project.name).toBe('Next')
  second.resolve(summary(3)); await vi.waitFor(() => expect(coordinator.status).toBe('Saved'))
  expect(coordinator.dirty).toBe(false)
})
it('retries an uncertain save with exactly the same operation and payload', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('Network lost')).mockResolvedValueOnce(summary(2))
  const coordinator = new SaveCoordinator(1, save, vi.fn())
  coordinator.enqueue(brief, {}); await vi.waitFor(() => expect(coordinator.status).toBe('Save failed'))
  await coordinator.flush()
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]); expect(coordinator.dirty).toBe(false)
})
it('preserves conflicting work and refuses automatic overwrite', async () => {
  const save = vi.fn().mockRejectedValue({ code: 'functions/aborted' })
  const coordinator = new SaveCoordinator(1, save, vi.fn())
  coordinator.enqueue(brief, {}); await vi.waitFor(() => expect(coordinator.status).toBe('Conflict'))
  coordinator.enqueue(brief, {}); await coordinator.flush()
  expect(save).toHaveBeenCalledTimes(1); expect(coordinator.dirty).toBe(true)
})
it('ignores completions after disposal and supports StrictMode effect reattachment', async () => {
  const pending = deferred<ProjectSummary>(); const changed = vi.fn()
  const coordinator = new SaveCoordinator(1, () => pending.promise, changed)
  coordinator.dispose(); coordinator.attach(); coordinator.enqueue(brief, {}); coordinator.dispose()
  const calls = changed.mock.calls.length; pending.resolve(summary(2)); await Promise.resolve()
  expect(changed).toHaveBeenCalledTimes(calls)
})

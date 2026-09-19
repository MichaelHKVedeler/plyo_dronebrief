import { beforeEach, expect, it } from 'vitest'
import { createBrief } from '@/features/briefs/model/brief'
import { loadMigration, saveMigration } from './migration-repository'

beforeEach(() => localStorage.clear())
it('reuses a durable migration operation and exact save request after a lost acknowledgment', async () => {
  const brief = createBrief({ name: 'Local project', clientName: 'Client' })
  const first = await loadMigration('user', 'org', brief)
  first.recovery.projectId = 'cloud-project'; first.recovery.payload = brief
  saveMigration(first.key, first.recovery)
  expect(await loadMigration('user', 'org', structuredClone(brief))).toEqual(first)
  first.recovery.complete = true; saveMigration(first.key, first.recovery)
  expect((await loadMigration('user', 'org', brief)).recovery.complete).toBe(true)
  expect((await loadMigration('another-user', 'org', brief)).recovery.projectId).toBeNull()
  expect((await loadMigration('user', 'another-org', brief)).recovery.projectId).toBeNull()
})

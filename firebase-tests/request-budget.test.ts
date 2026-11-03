import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from '../functions/src/context'
import { apiRequestBudgets, clearRequestBudgetDenialCache, consumeRequestBudgets, enforceApiBudget, enforcePublicTransferBudget, publicRequestBudgets, publicTransferBudgets, requestBudgetDocumentId, REQUEST_LIMITS, type RequestBudget } from '../functions/src/request-budget'

let env: RulesTestEnvironment
const start = 1_800_000_000_000
const budget = (identity: string, limit = 2): RequestBudget => ({ policy: 'audit', identity, limit, windowMs: 60_000 })
const ref = (item: RequestBudget) => db.collection('rateLimits').doc(requestBudgetDocumentId(item))
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-dronebrief' }) })
beforeEach(async () => { clearRequestBudgetDenialCache(); await env.clearFirestore() })
afterAll(async () => { await env.cleanup() })

describe('distributed request budgets', () => {
  it('atomically admits only the configured number of concurrent requests', async () => {
    const item = budget('concurrent', 3)
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => consumeRequestBudgets([item], start)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    for (const result of results) if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'resource-exhausted', details: { retryAfterSeconds: 60 } })
    expect((await ref(item).get()).get('count')).toBe(3)
  })

  it('isolates different principals and resets a fixed document in the next window', async () => {
    const alice = budget('alice', 1)
    const bob = budget('bob', 1)
    await consumeRequestBudgets([alice], start)
    await expect(consumeRequestBudgets([alice], start + 1000)).rejects.toMatchObject({ code: 'resource-exhausted', details: { retryAfterSeconds: 59 } })
    await consumeRequestBudgets([bob], start + 1000)
    await consumeRequestBudgets([alice], start + 60_000)
    expect((await db.collection('rateLimits').get()).size).toBe(2)
    const stored = await ref(alice).get()
    expect(stored.get('count')).toBe(1)
    expect(stored.get('windowStart')).toEqual(Timestamp.fromMillis(start + 60_000))
    expect(stored.get('expiresAt')).toEqual(Timestamp.fromMillis(start + 120_000))
  })

  it('charges none of the budgets when one is exhausted, including absent documents', async () => {
    const exhausted = budget('full', 1)
    const uncharged = budget('new', 10)
    await consumeRequestBudgets([exhausted], start)
    const before = await ref(exhausted).get()
    await expect(consumeRequestBudgets([uncharged, exhausted], start)).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect((await ref(uncharged).get()).exists).toBe(false)
    expect((await ref(exhausted).get()).updateTime).toEqual(before.updateTime)
  })

  it('shares a tighter processing budget across upload finalization and copying', async () => {
    for (let i = 0; i < REQUEST_LIMITS.processingUidMinute; i++) await consumeRequestBudgets(apiRequestBudgets('processor', 'network', 'finalizeUpload'), start)
    await expect(consumeRequestBudgets(apiRequestBudgets('processor', 'network', 'copyAsset'), start)).rejects.toMatchObject({ code: 'resource-exhausted' })
    await consumeRequestBudgets(apiRequestBudgets('processor', 'network', 'loadProject'), start)
  })

  it('uses a tighter account budget without granting unbounded account writes', async () => {
    for (let i = 0; i < REQUEST_LIMITS.accountUidMinute; i++) await consumeRequestBudgets(apiRequestBudgets('outsider', 'network', 'account'), start)
    await expect(consumeRequestBudgets(apiRequestBudgets('outsider', 'network', 'account'), start)).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  it('caches only exhausted scopes and rejects repeat abuse without another database transaction', async () => {
    for (let i = 0; i < REQUEST_LIMITS.accountUidMinute; i++) await enforceApiBudget('cached-outsider', 'network', 'account')
    await expect(enforceApiBudget('cached-outsider', 'network', 'account')).rejects.toMatchObject({ code: 'resource-exhausted' })
    const transactions = vi.spyOn(db, 'runTransaction')
    try {
      await expect(enforceApiBudget('cached-outsider', 'other-network', 'account')).rejects.toMatchObject({ code: 'resource-exhausted' })
      expect(transactions).not.toHaveBeenCalled()
      await enforceApiBudget('another-user', 'network', 'account')
      expect(transactions).toHaveBeenCalledTimes(1)
    } finally { transactions.mockRestore() }
  })

  it('blocks rotating anonymous tokens without creating new counter state after a global cap', async () => {
    const first = publicRequestBudgets('network-one', 'A'.repeat(43))
    const global = first.find((item) => item.policy === 'public-global-minute')!
    await ref(global).set({ policy: global.policy, windowStart: Timestamp.fromMillis(start), count: global.limit, expiresAt: Timestamp.fromMillis(start + 60_000) })
    for (const token of ['B'.repeat(43), 'C'.repeat(43)]) await expect(consumeRequestBudgets(publicRequestBudgets(`network-${token[0]}`, token), start)).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect((await db.collection('rateLimits').get()).size).toBe(1)
  })

  it('does not charge transfer bytes when admitting invented tokens or asset IDs', async () => {
    for (const token of ['H'.repeat(43), 'I'.repeat(43)]) await consumeRequestBudgets(publicRequestBudgets('network', token, crypto.randomUUID()), start)
    const documents = await db.collection('rateLimits').get()
    expect(documents.docs.some((doc) => String(doc.get('policy')).includes('bytes'))).toBe(false)
    expect(documents.size).toBe(5)
  })

  it('charges the exact validated response size and refuses transfer above the daily cap', async () => {
    const payload = Buffer.from(JSON.stringify({ brief: 'validated response content' }))
    const items = publicTransferBudgets('D'.repeat(43), payload.byteLength)
    const bytes = items.find((item) => item.policy === 'public-bytes-day')!
    const dayStart = Math.floor(start / bytes.windowMs) * bytes.windowMs
    await ref(bytes).set({ policy: bytes.policy, windowStart: Timestamp.fromMillis(dayStart), count: bytes.limit - payload.byteLength, expiresAt: Timestamp.fromMillis(dayStart + bytes.windowMs) })
    await consumeRequestBudgets(items, start)
    expect((await ref(bytes).get()).get('count')).toBe(bytes.limit)
    expect((await ref(items.find((item) => item.policy === 'public-token-bytes-day')!).get()).get('count')).toBe(payload.byteLength)
    await expect(consumeRequestBudgets(publicTransferBudgets('E'.repeat(43), 1), start)).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect((await db.collection('rateLimits').get()).size).toBe(2)
  })

  it('does not let a cached large-response denial block a smaller response that still fits', async () => {
    const token = 'G'.repeat(43)
    const bytes = publicTransferBudgets(token, 100).find((item) => item.policy === 'public-bytes-day')!
    const dayStart = Math.floor(Date.now() / bytes.windowMs) * bytes.windowMs
    await ref(bytes).set({ policy: bytes.policy, windowStart: Timestamp.fromMillis(dayStart), count: bytes.limit - 100, expiresAt: Timestamp.fromMillis(dayStart + bytes.windowMs) })
    await expect(enforcePublicTransferBudget(token, 200)).rejects.toMatchObject({ code: 'resource-exhausted' })
    await enforcePublicTransferBudget(token, 100)
    expect((await ref(bytes).get()).get('count')).toBe(bytes.limit)
  })

  it('isolates an exhausted transfer token and does not partially charge the global allowance', async () => {
    const first = publicTransferBudgets('J'.repeat(43), 100)
    const token = first.find((item) => item.policy === 'public-token-bytes-day')!
    const dayStart = Math.floor(start / token.windowMs) * token.windowMs
    await ref(token).set({ policy: token.policy, windowStart: Timestamp.fromMillis(dayStart), count: token.limit, expiresAt: Timestamp.fromMillis(dayStart + token.windowMs) })
    await expect(consumeRequestBudgets(first, start)).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect((await ref(first.find((item) => item.policy === 'public-bytes-day')!).get()).exists).toBe(false)
    await consumeRequestBudgets(publicTransferBudgets('K'.repeat(43), 100), start)
  })

  it('rejects malformed trusted transfer sizes before creating any counter state', async () => {
    for (const bytes of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => publicTransferBudgets('L'.repeat(43), bytes)).toThrow()
    expect((await db.collection('rateLimits').get()).empty).toBe(true)
  })

  it('stores hashed identifiers and contains no raw share token or IP address', async () => {
    const token = 'F'.repeat(43)
    const network = '203.0.113.7'
    await consumeRequestBudgets(publicRequestBudgets(network, token), start)
    await consumeRequestBudgets(publicTransferBudgets(token, 1024), start)
    const documents = await db.collection('rateLimits').get()
    const serialized = JSON.stringify(documents.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    expect(serialized).not.toContain(token)
    expect(serialized).not.toContain(network)
    expect(documents.docs.every((doc) => /^[a-f0-9]{64}$/.test(doc.id))).toBe(true)
  })

  it('fails closed on corrupted counter state and does not write another budget', async () => {
    const corrupt = budget('corrupt')
    const untouched = budget('untouched')
    await ref(corrupt).set({ count: -1, windowStart: Timestamp.fromMillis(start) })
    await expect(consumeRequestBudgets([corrupt, untouched], start)).rejects.toMatchObject({ code: 'unavailable' })
    expect((await ref(untouched).get()).exists).toBe(false)
  })
})

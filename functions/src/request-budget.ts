import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, hash } from './context.js'

const MINUTE = 60_000
const DAY = 86_400_000
const MIB = 1024 * 1024

// Fixed UTC windows intentionally bound backend work; they are not a cloud billing cap.
// Request admission is separate from charging the actual bytes of a validated response.
export const REQUEST_LIMITS = {
  apiGlobalMinute: 1000,
  apiGlobalDay: 100_000,
  apiUidMinute: 180,
  apiUidDay: 10_000,
  apiNetworkMinute: 600,
  accountUidMinute: 6,
  processingUidMinute: 20,
  publicNetworkMinute: 120,
  publicTokenMinute: 240,
  publicGlobalMinute: 1000,
  publicGlobalDay: 50_000,
  publicBytesDay: 16 * 1024 * MIB,
  publicTokenBytesDay: 4 * 1024 * MIB,
} as const

export type RequestBudget = {
  policy: string
  identity: string
  limit: number
  windowMs: number
  cost?: number
}

export function requestBudgetDocumentId(budget: Pick<RequestBudget, 'policy' | 'identity'>) {
  return hash(JSON.stringify([budget.policy, budget.identity]))
}

export function apiRequestBudgets(uid: string, networkKey: string, operation: string): RequestBudget[] {
  const budgets: RequestBudget[] = [
    { policy: 'api-global-minute', identity: 'all', limit: REQUEST_LIMITS.apiGlobalMinute, windowMs: MINUTE },
    { policy: 'api-global-day', identity: 'all', limit: REQUEST_LIMITS.apiGlobalDay, windowMs: DAY },
    { policy: 'api-uid-minute', identity: uid, limit: REQUEST_LIMITS.apiUidMinute, windowMs: MINUTE },
    { policy: 'api-uid-day', identity: uid, limit: REQUEST_LIMITS.apiUidDay, windowMs: DAY },
    { policy: 'api-network-minute', identity: networkKey, limit: REQUEST_LIMITS.apiNetworkMinute, windowMs: MINUTE },
  ]
  if (operation === 'account') budgets.push({ policy: 'account-uid-minute', identity: uid, limit: REQUEST_LIMITS.accountUidMinute, windowMs: MINUTE })
  if (operation === 'finalizeUpload' || operation === 'copyAsset') budgets.push({ policy: 'processing-uid-minute', identity: uid, limit: REQUEST_LIMITS.processingUidMinute, windowMs: MINUTE })
  return budgets
}

export function publicRequestBudgets(networkKey: string, token: string, _assetId?: string): RequestBudget[] {
  return [
    { policy: 'public-global-minute', identity: 'all', limit: REQUEST_LIMITS.publicGlobalMinute, windowMs: MINUTE },
    { policy: 'public-global-day', identity: 'all', limit: REQUEST_LIMITS.publicGlobalDay, windowMs: DAY },
    { policy: 'public-network-minute', identity: networkKey, limit: REQUEST_LIMITS.publicNetworkMinute, windowMs: MINUTE },
    { policy: 'public-token-minute', identity: token, limit: REQUEST_LIMITS.publicTokenMinute, windowMs: MINUTE },
  ]
}

/** Call only after authorizing the share and validating its response or asset size. */
export function publicTransferBudgets(token: string, bytes: number): RequestBudget[] {
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw unavailable()
  return [
    { policy: 'public-bytes-day', identity: 'all', limit: REQUEST_LIMITS.publicBytesDay, windowMs: DAY, cost: bytes },
    { policy: 'public-token-bytes-day', identity: token, limit: REQUEST_LIMITS.publicTokenBytesDay, windowMs: DAY, cost: bytes },
  ]
}

function unavailable() {
  return new HttpsError('unavailable', 'Request limits are temporarily unavailable. Retry shortly.', { retryAfterSeconds: 30 })
}

type ExhaustedBudget = { id: string; retryAt: number; remaining: number }
class BudgetExceededError extends HttpsError {
  constructor(readonly exhausted: ExhaustedBudget[], nowMs: number) {
    const retryAfterSeconds = Math.max(1, ...exhausted.map(({ retryAt }) => Math.ceil((retryAt - nowMs) / 1000)))
    super('resource-exhausted', 'Too many requests. Try again later.', { retryAfterSeconds })
  }
}

// This cache only rejects previously exhausted scopes; it can never admit a request.
// Keep the scope's actual window boundary, so a UID denial cannot block other UIDs.
const denialCache = new Map<string, Omit<ExhaustedBudget, 'id'>>()
const MAX_DENIALS = 1024
export function clearRequestBudgetDenialCache() { denialCache.clear() }

async function enforceBudgets(budgets: RequestBudget[]) {
  const time = Date.now()
  const cached: ExhaustedBudget[] = []
  for (const budget of budgets) {
    const id = requestBudgetDocumentId(budget)
    const entry = denialCache.get(id)
    if (entry !== undefined) {
      if (entry.retryAt <= time) denialCache.delete(id)
      else if ((budget.cost ?? 1) > entry.remaining) cached.push({ id, ...entry })
    }
  }
  if (cached.length) throw new BudgetExceededError(cached, time)
  try {
    await consumeRequestBudgets(budgets, time)
  } catch (error) {
    if (error instanceof BudgetExceededError) for (const { id, retryAt, remaining } of error.exhausted) {
      if (!denialCache.has(id) && denialCache.size >= MAX_DENIALS) denialCache.delete(denialCache.keys().next().value!)
      const previous = denialCache.get(id)
      denialCache.set(id, { retryAt, remaining: previous?.retryAt === retryAt ? Math.min(previous.remaining, remaining) : remaining })
    }
    throw error
  }
}

/** Atomically charges every budget, or charges none. No process-local allow cache. */
export async function consumeRequestBudgets(budgets: readonly RequestBudget[], nowMs = Date.now()): Promise<void> {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || budgets.length === 0 || budgets.length > 12) throw unavailable()
  const unique = new Map<string, Required<RequestBudget>>()
  for (const budget of budgets) {
    const cost = budget.cost ?? 1
    if (typeof budget.policy !== 'string' || !/^[a-z0-9-]{1,100}$/.test(budget.policy)
      || typeof budget.identity !== 'string' || !budget.identity || budget.identity.length > 512
      || !Number.isSafeInteger(budget.limit) || budget.limit < 1
      || !Number.isSafeInteger(budget.windowMs) || budget.windowMs < 1
      || !Number.isSafeInteger(cost) || cost < 1 || cost > budget.limit) throw unavailable()
    const id = requestBudgetDocumentId(budget)
    const existing = unique.get(id)
    if (existing && (existing.limit !== budget.limit || existing.windowMs !== budget.windowMs)) throw unavailable()
    const combined = (existing?.cost ?? 0) + cost
    if (!Number.isSafeInteger(combined)) throw unavailable()
    unique.set(id, { ...budget, cost: combined })
  }
  const entries = [...unique].map(([id, budget]) => ({ ref: db.collection('rateLimits').doc(id), budget }))
  try {
    await db.runTransaction(async (tx) => {
      const snapshots = await tx.getAll(...entries.map(({ ref }) => ref))
      const exhausted: ExhaustedBudget[] = []
      const changes = entries.map(({ ref, budget }, index) => {
        const windowStart = Math.floor(nowMs / budget.windowMs) * budget.windowMs
        const end = windowStart + budget.windowMs
        const current = snapshots[index]
        let count = 0
        if (current.exists) {
          const storedStart: unknown = current.get('windowStart')
          const storedCount: unknown = current.get('count')
          if (!(storedStart instanceof Timestamp) || typeof storedCount !== 'number'
            || !Number.isSafeInteger(storedCount) || storedCount < 0
            || storedStart.toMillis() > windowStart) throw unavailable()
          if (storedStart.toMillis() === windowStart) count = storedCount
        }
        if (budget.cost > budget.limit - count) exhausted.push({ id: ref.id, retryAt: end, remaining: Math.max(0, budget.limit - count) })
        return { ref, policy: budget.policy, windowStart: Timestamp.fromMillis(windowStart), count: count + budget.cost, expiresAt: Timestamp.fromMillis(end) }
      })
      if (exhausted.length) throw new BudgetExceededError(exhausted, nowMs)
      // Every check has passed and every read has completed before any write is queued.
      for (const { ref, ...data } of changes) tx.set(ref, data)
    })
  } catch (error) {
    if (error instanceof HttpsError) throw error
    // A database outage or transaction contention must never bypass the limit.
    throw unavailable()
  }
}

export async function enforceApiBudget(uid: string, networkKey: string, operation: string): Promise<void> {
  await enforceBudgets(apiRequestBudgets(uid, networkKey, operation))
}

export async function enforcePublicBudget(networkKey: string, token: string, assetId?: string): Promise<void> {
  await enforceBudgets(publicRequestBudgets(networkKey, token, assetId))
}

export async function enforcePublicTransferBudget(token: string, bytes: number): Promise<void> {
  await enforceBudgets(publicTransferBudgets(token, bytes))
}

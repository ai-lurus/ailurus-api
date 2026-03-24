/**
 * In-memory session store for agent context.
 *
 * Each session is keyed by `${userId}:${date}` so it automatically
 * starts fresh each day without any manual cleanup.
 *
 * Stored per session:
 *   - user: { id, name, email }
 *   - dailyStatus: the developer's check-in for today (or null)
 *   - tasks: their backlog + in-progress tasks
 *
 * This avoids re-querying the DB on every chat turn.
 *
 * Eviction: stale (yesterday or older) entries are pruned on every write.
 * A hard cap of MAX_SESSIONS prevents unbounded growth on busy days.
 */

const MAX_SESSIONS = 500
const store = new Map()

function sessionKey(userId, date) {
  const d = date ?? new Date().toISOString().slice(0, 10)
  return `${userId}:${d}`
}

function pruneStale() {
  const today = new Date().toISOString().slice(0, 10)
  for (const key of store.keys()) {
    const date = key.split(':')[1]
    if (date && date < today) store.delete(key)
  }
  // Hard cap: evict oldest entries if still over limit
  if (store.size > MAX_SESSIONS) {
    const excess = store.size - MAX_SESSIONS
    let removed = 0
    for (const key of store.keys()) {
      if (removed++ >= excess) break
      store.delete(key)
    }
  }
}

export function getSession(userId, date) {
  return store.get(sessionKey(userId, date)) ?? null
}

export function setSession(userId, context, date) {
  pruneStale()
  store.set(sessionKey(userId, date), context)
}

export function clearSession(userId, date) {
  store.delete(sessionKey(userId, date))
}

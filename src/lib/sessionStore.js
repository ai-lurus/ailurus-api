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
 */

const store = new Map()

function sessionKey(userId, date) {
  const d = date ?? new Date().toISOString().slice(0, 10)
  return `${userId}:${d}`
}

export function getSession(userId, date) {
  return store.get(sessionKey(userId, date)) ?? null
}

export function setSession(userId, context, date) {
  store.set(sessionKey(userId, date), context)
}

export function clearSession(userId, date) {
  store.delete(sessionKey(userId, date))
}

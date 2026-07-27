/**
 * One owner for everything this app leaves on the device.
 *
 * The site is public and runs on whatever machine the candidate happens to be
 * sitting at — a library terminal, a friend's laptop. What it stores is not
 * incidental: interview history, and free-text answers about salary
 * expectations, notice periods and current employer that the pipeline extracts
 * into a candidate profile. Until now that was written once and kept forever,
 * with no way to remove it from inside the app and no mention that it existed.
 *
 * Three rules, enforced here rather than at each call site:
 *   - every key lives under one namespace, so "delete it all" is exhaustive;
 *   - records expire on their own after RETENTION_DAYS;
 *   - nothing is written that the user has not been told about.
 */

/** Namespace shared by every key the app writes. `clearAll()` relies on it. */
export const STORAGE_PREFIX = 'devops-interview-web:'

/** Records older than this are dropped at boot, without asking. */
export const RETENTION_DAYS = 90

const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

/**
 * Whether a stored timestamp is still inside the retention window.
 *
 * An unparseable or missing timestamp counts as *live*: these records predate
 * the policy, and silently deleting a candidate's history because an older
 * build wrote it without a date would be the worse failure.
 */
export function isWithinRetention(timestamp: string | undefined, now = Date.now()): boolean {
  if (!timestamp) return true
  const at = Date.parse(timestamp)
  if (Number.isNaN(at)) return true
  return now - at < RETENTION_MS
}

function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Every namespaced key currently present, as a plain array (the live index shifts as you delete). */
export function listLocalDataKeys(): string[] {
  if (!isStorageAvailable()) return []
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  return keys
}

/**
 * Wipes everything under the namespace — history, pipeline progress, the
 * language preference, this note's own dismissal flag.
 *
 * Deliberately not selective. "Clear my data" on a shared machine has to mean
 * no trace, and a leftover language choice is still a trace of who was here.
 *
 * Returns the keys removed, which is what makes this testable.
 */
export function clearAllLocalData(): string[] {
  const keys = listLocalDataKeys()
  for (const key of keys) localStorage.removeItem(key)
  return keys
}

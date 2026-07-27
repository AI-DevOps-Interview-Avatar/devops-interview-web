import type { QuestionLevel } from '../domain/models/questionBank'
import { isWithinRetention, STORAGE_PREFIX } from './localData'

export interface SessionRecord {
  interviewerId: string
  level: QuestionLevel
  finishedAt: string
  askedCount: number
  answeredCount: number
  completionRate: number
  avgAnswerWords: number
  categories: string[]
}

const STORAGE_KEY = `${STORAGE_PREFIX}history`

/** Drops records past the retention window. Pure, so the boundary is testable without a clock. */
export function withinRetention(history: SessionRecord[], now = Date.now()): SessionRecord[] {
  return history.filter((record) => isWithinRetention(record.finishedAt, now))
}

function readRaw(): SessionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : []
  } catch {
    return []
  }
}

export function loadHistory(): SessionRecord[] {
  return withinRetention(readRaw())
}

export function appendHistory(record: SessionRecord): void {
  const history = loadHistory()
  history.unshift(record)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

/**
 * Deletes expired records from storage rather than merely hiding them.
 *
 * `loadHistory()` already filters, but filtering on read leaves the bytes on
 * the device indefinitely for anyone who never opens the History page — which
 * is the opposite of a retention policy. Called once at boot; writes only when
 * something actually expired, so it costs nothing on the common path.
 */
export function pruneExpiredHistory(now = Date.now()): number {
  if (typeof localStorage === 'undefined') return 0
  const stored = readRaw()
  const kept = withinRetention(stored, now)
  const removed = stored.length - kept.length
  if (removed === 0) return 0
  if (kept.length === 0) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
  return removed
}

/** Average completion rate across all past sessions for one interviewer persona. */
export function averageCompletionFor(history: SessionRecord[], interviewerId: string): number | null {
  const sessions = history.filter((r) => r.interviewerId === interviewerId)
  if (sessions.length === 0) return null
  return Math.round(sessions.reduce((sum, r) => sum + r.completionRate, 0) / sessions.length)
}

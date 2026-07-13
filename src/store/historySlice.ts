import type { QuestionLevel } from '../domain/models/questionBank'

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

const STORAGE_KEY = 'devops-interview-web:history'

export function loadHistory(): SessionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SessionRecord[]
  } catch {
    return []
  }
}

export function appendHistory(record: SessionRecord): void {
  const history = loadHistory()
  history.unshift(record)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

/** Average completion rate across all past sessions for one interviewer persona. */
export function averageCompletionFor(history: SessionRecord[], interviewerId: string): number | null {
  const sessions = history.filter((r) => r.interviewerId === interviewerId)
  if (sessions.length === 0) return null
  return Math.round(sessions.reduce((sum, r) => sum + r.completionRate, 0) / sessions.length)
}

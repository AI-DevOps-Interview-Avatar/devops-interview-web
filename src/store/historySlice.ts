export interface SessionRecord {
  interviewerId: string
  finishedAt: string
  questionCount: number
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

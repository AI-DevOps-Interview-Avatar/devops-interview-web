import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadHistory, type SessionRecord } from '../../store/historySlice'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'

export default function HistoryPage() {
  const [history] = useState<SessionRecord[]>(() => loadHistory())

  return (
    <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>Історія інтерв'ю</h1>
      {history.length === 0 && <p>Ще немає завершених сесій.</p>}
      <ul>
        {history.map((record, idx) => {
          const interviewer = INTERVIEWERS.find((i) => i.id === record.interviewerId)
          return (
            <li key={idx}>
              {new Date(record.finishedAt).toLocaleString()} — {interviewer?.role ?? record.interviewerId} (
              {record.questionCount} питань)
            </li>
          )
        })}
      </ul>
      <Link to="/interview">← Нове інтерв'ю</Link>
    </main>
  )
}

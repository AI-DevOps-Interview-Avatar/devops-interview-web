import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loadHistory, type SessionRecord } from '../../store/historySlice'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'

export default function HistoryPage() {
  const [history] = useState<SessionRecord[]>(() => loadHistory())
  const { t } = useTranslation()

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: 640,
        margin: '0 auto',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />
      <h1>{t('history.title')}</h1>
      {history.length === 0 && <p>{t('history.empty')}</p>}
      <ul>
        {history.map((record, idx) => {
          const interviewer = INTERVIEWERS.find((i) => i.id === record.interviewerId)
          return (
            <li key={idx}>
              {new Date(record.finishedAt).toLocaleString()} — {interviewer?.role ?? record.interviewerId} (
              {t('history.questions', { count: record.questionCount })})
            </li>
          )
        })}
      </ul>
      <Link to="/interview" style={{ color: '#c084fc' }}>
        {t('history.newInterview')}
      </Link>
    </main>
  )
}

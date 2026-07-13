import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { averageCompletionFor, loadHistory, type SessionRecord } from '../../store/historySlice'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'

export default function HistoryPage() {
  const [history] = useState<SessionRecord[]>(() => loadHistory())
  const { t } = useTranslation()

  const interviewerIdsWithHistory = Array.from(new Set(history.map((r) => r.interviewerId)))

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

      {interviewerIdsWithHistory.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '1.5rem', color: '#9ca3af' }}>
          {interviewerIdsWithHistory.map((id) => {
            const role = INTERVIEWERS.find((i) => i.id === id)?.role ?? id
            const rate = averageCompletionFor(history, id)
            return (
              <p key={id} style={{ margin: 0, fontSize: 14 }}>
                {t('history.average', { role, rate })}
              </p>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {history.map((record, idx) => {
          const interviewer = INTERVIEWERS.find((i) => i.id === record.interviewerId)
          return (
            <div
              key={idx}
              style={{
                background: '#1c1d23',
                border: '1px solid #2e303a',
                borderRadius: 12,
                padding: '0.75rem 1rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                {interviewer?.role ?? record.interviewerId}{' '}
                <span style={{ color: interviewer?.color, fontWeight: 400 }}>
                  ({t(`level.${record.level}`)})
                </span>
              </p>
              <p style={{ margin: '2px 0', color: '#9ca3af', fontSize: 13 }}>
                {new Date(record.finishedAt).toLocaleString()}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                {t('history.completion', { rate: record.completionRate })} ·{' '}
                {t('history.avgWords', { count: record.avgAnswerWords })}
              </p>
              {record.categories.length > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>{record.categories.join(', ')}</p>
              )}
            </div>
          )
        })}
      </div>

      <Link to="/interview" style={{ color: '#c084fc', display: 'inline-block', marginTop: '1.5rem' }}>
        {t('history.newInterview')}
      </Link>
    </main>
  )
}

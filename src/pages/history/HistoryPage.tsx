import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { averageCompletionFor, loadHistory, type SessionRecord } from '../../store/historySlice'
import { clearAllLocalData } from '../../store/localData'
import { resetPipeline } from '../../store/pipelineSlice'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import { PrivacyNote } from '../../shared/ui/PrivacyNote'

export default function HistoryPage() {
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory())
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const interviewerIdsWithHistory = Array.from(new Set(history.map((r) => r.interviewerId)))

  const clearData = () => {
    if (!window.confirm(t('privacy.clearConfirm'))) return
    clearAllLocalData()
    // Storage is only half of it — the pipeline slice is holding the same
    // answers in memory, and the store's persist subscription would write them
    // straight back on the next dispatch.
    dispatch(resetPipeline())
    setHistory([])
  }

  return (
    <main className="page">
      <div className="page__chrome">
        <PageNav />
        <LanguageSwitcher />
      </div>
      <h1>{t('history.title')}</h1>
      <div style={{ margin: '1rem 0 1.25rem' }}>
        <PrivacyNote />
      </div>
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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <Link to="/interview" style={{ color: '#c084fc' }}>
          {t('history.newInterview')}
        </Link>
        <button
          onClick={clearData}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: 999,
            border: '1px solid #4b2330',
            background: 'transparent',
            color: '#f87171',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('privacy.clear')}
        </button>
      </div>
    </main>
  )
}

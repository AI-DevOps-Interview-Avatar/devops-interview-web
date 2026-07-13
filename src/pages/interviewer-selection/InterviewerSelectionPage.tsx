import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'

export default function InterviewerSelectionPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('selection.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('selection.subtitle')}</p>
        <Link to="/history" style={{ color: '#c084fc' }}>
          {t('selection.historyLink')}
        </Link>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {INTERVIEWERS.map((interviewer) => (
          <button
            key={interviewer.id}
            aria-label={`${interviewer.role} card, ${interviewer.difficulty} difficulty`}
            onClick={() => navigate(`/interview/${interviewer.id}`)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'flex-start',
              borderRadius: 16,
              padding: '1.25rem',
              textAlign: 'left',
              cursor: 'pointer',
              background: '#2a2b33',
              border: '1px solid #383944',
              color: 'inherit',
            }}
          >
            <AvatarTile interviewer={interviewer} isSpeaking={false} size={72} />
            <div>
              <h2 style={{ margin: 0 }}>{interviewer.role}</h2>
              <p style={{ margin: '2px 0', color: '#9ca3af' }}>{interviewer.voiceName}</p>
            </div>
            <span
              style={{
                color: interviewer.color,
                border: `1px solid ${interviewer.color}`,
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t(`difficulty.${interviewer.difficulty}`)}
            </span>
            <p style={{ margin: 0, color: '#d1d5db' }}>
              {t(`interviewers.${interviewer.id}.description`)}
            </p>
          </button>
        ))}
      </div>
    </main>
  )
}

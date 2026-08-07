import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { HeroBackground } from '../../shared/ui/HeroBackground'
import { PrivacyNote } from '../../shared/ui/PrivacyNote'

const NAV_LINKS: { to: string; icon: string; labelKey: string }[] = [
  { to: '/pipeline', icon: '🎯', labelKey: 'selection.pipelineLink' },
  { to: '/practice', icon: '🧠', labelKey: 'selection.practiceLink' },
  { to: '/resume-review', icon: '📄', labelKey: 'selection.resumeReviewLink' },
  { to: '/resources', icon: '💼', labelKey: 'selection.resourcesLink' },
  { to: '/developers', icon: '👨‍💻', labelKey: 'selection.developersLink' },
  { to: '/history', icon: '📈', labelKey: 'selection.historyLink' },
  { to: '/engine', icon: '⚙️', labelKey: 'selection.engineLink' },
]

export default function InterviewerSelectionPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <main className="page page--hero">
      <HeroBackground />

      <div className="page__inner">
        {/* Home is this screen, so the chrome carries the switcher alone. */}
        <div className="page__chrome">
          <LanguageSwitcher />
        </div>

        <header className="page__header">
          <h1 style={{ margin: 0 }}>{t('selection.title')}</h1>
          <p style={{ color: '#9ca3af' }}>{t('selection.subtitle')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.75rem' }}>
            {NAV_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="nav-pill">
                <span aria-hidden="true">{link.icon}</span>
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </header>

        {/* First screen a candidate reaches, and the last one before they start
            answering — so this is where the storage note belongs. */}
        <div style={{ marginBottom: '1.25rem', maxWidth: 720 }}>
          <PrivacyNote dismissible />
        </div>

        <div className="card-grid">
          {INTERVIEWERS.map((interviewer) => (
            <button
              key={interviewer.id}
              data-testid="interviewer-card"
              data-interviewer-id={interviewer.id}
              aria-label={`${interviewer.role} card, ${interviewer.difficulty} difficulty`}
              onClick={() => navigate(`/interview/${interviewer.id}`)}
              className="glass-card"
              style={{
                ['--accent' as string]: interviewer.color,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                alignItems: 'flex-start',
                padding: 'clamp(0.9rem, 4vw, 1.25rem)',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'inherit',
              } as CSSProperties}
            >
              <AvatarTile interviewer={interviewer} isSpeaking={false} size={72} />
              <div>
                <h2 style={{ margin: 0 }}>{interviewer.role}</h2>
                <p style={{ margin: '2px 0', color: '#9ca3af' }}>{interviewer.voiceName}</p>
              </div>
              <span className="glass-card__badge" style={{ borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
                {t(`difficulty.${interviewer.difficulty}`)}
              </span>
              <p style={{ margin: 0, color: '#d1d5db' }}>
                {t(`interviewers.${interviewer.id}.description`)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

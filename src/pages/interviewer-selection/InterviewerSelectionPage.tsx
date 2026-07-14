import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { HeroBackground } from '../../shared/ui/HeroBackground'

const NAV_LINKS: { to: string; icon: string; labelKey: string }[] = [
  { to: '/pipeline', icon: '🎯', labelKey: 'selection.pipelineLink' },
  { to: '/practice', icon: '🧠', labelKey: 'selection.practiceLink' },
  { to: '/resume-review', icon: '📄', labelKey: 'selection.resumeReviewLink' },
  { to: '/resources', icon: '💼', labelKey: 'selection.resourcesLink' },
  { to: '/developers', icon: '👨‍💻', labelKey: 'selection.developersLink' },
  { to: '/history', icon: '📈', labelKey: 'selection.historyLink' },
]

export default function InterviewerSelectionPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(180deg, #070b14 0%, #0b1220 60%, #070b14 100%)',
        color: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      <HeroBackground />
      <LanguageSwitcher />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: '1.5rem' }}>
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
              className="glass-card"
              style={{
                ['--accent' as string]: interviewer.color,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                alignItems: 'flex-start',
                padding: '1.25rem',
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

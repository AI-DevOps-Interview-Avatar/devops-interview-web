import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { isProUnlocked, type ProFeature } from '../../domain/pro'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { AppFooter } from '../../shared/ui/AppFooter'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { HeroBackground } from '../../shared/ui/HeroBackground'
import { EngineNote } from '../../shared/ui/EngineNote'
import { PrivacyNote } from '../../shared/ui/PrivacyNote'

/**
 * The row of pills is the product, and only the product.
 *
 * Two things left it in DIA-218. "Developers" is an about page and now sits in
 * the footer; the local engine check is a diagnostic and now sits in the advice
 * block below, next to the privacy note. Both were being read as a fifth and
 * sixth thing to try because they were drawn like one.
 */
const NAV_LINKS: { to: string; icon: string; labelKey: string; pro?: ProFeature }[] = [
  { to: '/pipeline', icon: '🎯', labelKey: 'selection.pipelineLink' },
  { to: '/practice', icon: '🧠', labelKey: 'selection.practiceLink', pro: 'practice' },
  { to: '/resume-review', icon: '📄', labelKey: 'selection.resumeReviewLink', pro: 'resumeReview' },
  { to: '/resources', icon: '💼', labelKey: 'selection.resourcesLink' },
  { to: '/history', icon: '📈', labelKey: 'selection.historyLink' },
]

export default function InterviewerSelectionPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Read once. The entitlement cannot change without a reload — there is no
  // checkout in the page to change it — and re-reading storage on every render
  // would only make that look otherwise.
  const [proUnlocked] = useState(isProUnlocked)

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
            {NAV_LINKS.map((link) => {
              const locked = link.pro !== undefined && !proUnlocked
              return (
                <Link
                  key={link.to}
                  // A locked pill leads to the price, not to a door that closes
                  // in the visitor's face. The route itself is gated too — see
                  // ProGate — for everyone who arrives by link rather than pill.
                  to={locked ? `/pro?feature=${link.pro}` : link.to}
                  className="nav-pill"
                  data-testid={locked ? 'nav-pill-locked' : 'nav-pill'}
                  data-pro-feature={link.pro}
                >
                  <span aria-hidden="true">{link.icon}</span>
                  {t(link.labelKey)}
                  {locked && (
                    <span className="nav-pill__lock">
                      <span aria-hidden="true">🔒</span> {t('pro.badge')}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </header>

        {/* First screen a candidate reaches, and the last one before they start
            answering — so this is where the storage note belongs. */}
        <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem', maxWidth: 720 }}>
          <PrivacyNote dismissible />
          {/* Below the privacy note on purpose: where the answers go is something
              a candidate needs to know, while the local model is something they
              may want. */}
          <EngineNote />
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
              <AvatarTile interviewer={interviewer} isSpeaking={false} size={72} interactive />
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

        <AppFooter />
      </div>
    </main>
  )
}

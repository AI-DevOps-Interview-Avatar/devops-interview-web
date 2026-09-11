import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import { PRO_FEATURES, PRO_PLANS, savingPercent, type ProFeature } from '../../domain/pro'

/**
 * Where the announcement will go out. The project's existing channel, not a new
 * one: the point is to reach people who already follow this app, and a mailing
 * list would mean collecting addresses on a site whose whole pitch is that it
 * collects nothing.
 */
const NOTIFY_URL = 'https://t.me/+cO9CESqrxkRjNzJi'

function isProFeature(value: string | null): value is ProFeature {
  return PRO_FEATURES.some((feature) => feature === value)
}

/**
 * The plans, and an honest account of what they can and cannot do yet.
 *
 * Reached two ways: from the locked nav pills, and by redirect from a gated
 * screen — `ProGate` passes the screen that was asked for as `?feature=`, so a
 * visitor who clicked "Resume review" is told about Resume review rather than
 * dropped on a generic price list and left to work out what happened.
 */
export default function ProPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()

  const requested = params.get('feature')
  const feature = isProFeature(requested) ? requested : null

  return (
    <main className="page page--wide">
      <div className="page__chrome">
        <PageNav />
        <LanguageSwitcher />
      </div>

      <header className="page__header">
        <h1 style={{ margin: 0 }}>{t('pro.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('pro.subtitle')}</p>
      </header>

      {/* Only when a gate sent them here. Opening /pro directly is a question
          about the price, not about a door that just closed. */}
      {feature && (
        <p
          data-testid="pro-requested"
          style={{
            margin: '0 0 1.25rem',
            padding: '0.7rem 0.9rem',
            borderRadius: 12,
            border: '1px solid #383944',
            background: '#2a2b33',
            color: '#e5e7eb',
            fontSize: 14,
          }}
        >
          <span aria-hidden="true">🔒 </span>
          {t('pro.requested', { feature: t(`pro.features.${feature}.name`) })}
        </p>
      )}

      <h2 style={{ margin: '0 0 0.75rem' }}>{t('pro.includedTitle')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
        {PRO_FEATURES.map((included) => (
          <div
            key={included}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 12,
              border: '1px solid #383944',
              background: '#2a2b33',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>{t(`pro.features.${included}.name`)}</p>
            <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
              {t(`pro.features.${included}.blurb`)}
            </p>
          </div>
        ))}
      </div>

      <h2 style={{ margin: '0 0 0.75rem' }}>{t('pro.plansTitle')}</h2>
      <div className="plan-grid" data-testid="pro-plans">
        {PRO_PLANS.map((plan) => {
          const saving = savingPercent(plan)
          return (
            <div
              key={plan.id}
              data-testid="pro-plan"
              data-plan-id={plan.id}
              className={`plan-card${plan.recommended ? ' plan-card--recommended' : ''}`}
            >
              {plan.recommended && <span className="plan-card__flag">{t('pro.bestValue')}</span>}
              <p style={{ margin: 0, fontWeight: 600 }}>{t(`pro.plans.${plan.id}.name`)}</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: 28, fontWeight: 700 }}>${plan.priceUsd}</p>
              <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: 14 }}>
                {t(`pro.plans.${plan.id}.period`)}
              </p>
              {saving !== null && (
                <p style={{ margin: '0.5rem 0 0', color: '#c084fc', fontSize: 14, fontWeight: 600 }}>
                  {t('pro.save', { percent: saving })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* The part it would be easy to leave out. A price list with a button that
          does not charge anything reads as a broken checkout unless the page
          says, in the same breath, that there is no checkout yet. */}
      <p
        data-testid="pro-not-live"
        style={{
          margin: '1.25rem 0 0',
          padding: '0.7rem 0.9rem',
          borderRadius: 12,
          border: '1px solid #2e303a',
          background: 'rgba(20, 25, 40, 0.55)',
          color: '#9ca3af',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <span aria-hidden="true">ℹ️ </span>
        {t('pro.notLive')}
      </p>

      <a
        href={NOTIFY_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="pro-notify"
        className="nav-pill"
        style={{ marginTop: '1rem' }}
      >
        <span aria-hidden="true">📣</span>
        {t('pro.notify')}
      </a>

      <h2 style={{ margin: '2rem 0 0.5rem' }}>{t('pro.freeTitle')}</h2>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>{t('pro.freeBody')}</p>
    </main>
  )
}

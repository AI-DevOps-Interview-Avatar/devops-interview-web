import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import {
  grantProEntitlement,
  isProUnlocked,
  PRO_FEATURES,
  PRO_PLANS,
  savingPercent,
  TESTER_UNLOCK_PLAN,
  unlockCodeMatches,
  type ProFeature,
} from '../../domain/pro'

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
 * Spends the `?unlock=` parameter, once, before the first paint.
 *
 * Run as a `useState` initialiser rather than in an effect so the banner and the
 * entitlement appear together: an effect would render the price list first and
 * replace it a frame later, which reads as the page changing its mind.
 *
 * The code is then dropped from the address bar. It is not a secret worth
 * defending — the bundle contains it — but a tester who screenshots this page,
 * or hands over a laptop with the history intact, should not be passing it on
 * without meaning to.
 */
function useTesterUnlock(code: string | null): boolean {
  const [granted] = useState(() => {
    if (!unlockCodeMatches(code)) return false

    // Already had a plan: nothing to grant, and no banner either — that message
    // belongs to the moment access is given, not to every later visit.
    if (isProUnlocked()) return false

    return grantProEntitlement(TESTER_UNLOCK_PLAN, 'tester') !== null
  })

  // In an effect rather than beside the grant above: rewriting the address bar
  // is a side effect, and one frame later is soon enough for something nobody
  // is looking at. `replaceState` keeps it out of the history rather than adding
  // a second entry that Back would walk into.
  useEffect(() => {
    if (!code) return

    const url = new URL(globalThis.location.href)
    if (!url.searchParams.has('unlock')) return

    url.searchParams.delete('unlock')
    globalThis.history.replaceState(null, '', url)
  }, [code])

  return granted
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
  const unlocked = useTesterUnlock(params.get('unlock'))

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

      {/* The tester link just worked. Said out loud because the alternative is a
          price list that looks exactly as it did a second ago, leaving the
          tester to guess whether the link did anything. */}
      {unlocked && (
        <p
          data-testid="pro-tester-unlocked"
          style={{
            margin: '0 0 1.25rem',
            padding: '0.7rem 0.9rem',
            borderRadius: 12,
            border: '1px solid #3f6212',
            background: 'rgba(63, 98, 18, 0.25)',
            color: '#e5e7eb',
            fontSize: 14,
          }}
        >
          <span aria-hidden="true">🔓 </span>
          {t('pro.testerUnlock.granted')}{' '}
          <Link data-testid="pro-tester-unlocked-link" to="/interview" style={{ color: '#c084fc' }}>
            {t('pro.testerUnlock.back')}
          </Link>
        </p>
      )}

      {/* Only when a gate sent them here, and only while the door is still shut.
          Opening /pro directly is a question about the price, not about a door
          that just closed — and telling a tester a screen is locked in the same
          breath as unlocking it is worse than saying nothing. */}
      {feature && !unlocked && (
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { prefetchRiveBuffers, riveAssetUrl } from '../../shared/ui/riveBufferCache'

/**
 * Заглушка bootstrap-екрану моделі. Реальне завантаження .task бандла
 * та кешування через Cache API/IndexedDB — DIA-97/DIA-98.
 */
export default function SplashPage() {
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Set only by the Lighthouse gate (scripts/lighthouseGate.mjs) on the `/`
  // route. Without it, this screen's own bootstrap timer forwards to
  // /interview after ~1.8s — well inside the window Lighthouse watches after
  // load, so the gate ended up scoring splash, the redirect and the first
  // paint of /interview as one load. Read once: a language switch or any
  // other re-render must not have the flag start being honoured or dropped
  // mid-audit.
  const [auditIsolation] = useState(
    () => new URLSearchParams(window.location.search).get('lhAuditIsolation') === '1',
  )

  // The bootstrap bar runs for about a second and a half — enough to pull every
  // avatar into the buffer cache, so the selection screen behind it paints
  // finished faces instead of placeholders.
  //
  // Deferred past idle rather than fired on mount: this screen draws no
  // avatar at all, yet DIA-201 measured its LCP taking the same ~1.5s hit as
  // /interview, which does. Four requests opened the instant this component
  // mounts compete with the title text this page actually needs to paint
  // first; idle callback lets that paint happen, then spends the bootstrap
  // bar's remaining time warming the cache same as before.
  useEffect(() => {
    const urls = INTERVIEWERS.map((profile) => riveAssetUrl(profile.riveFile))
    const runPrefetch = () => prefetchRiveBuffers(urls)

    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(runPrefetch)
      return () => cancelIdleCallback(handle)
    }
    const timer = setTimeout(runPrefetch, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 10, 100)
        if (next === 100) {
          clearInterval(interval)
          if (!auditIsolation) setTimeout(() => navigate('/interview'), 300)
        }
        return next
      })
    }, 150)
    return () => clearInterval(interval)
  }, [navigate, auditIsolation])

  return (
    <main
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        minHeight: '100svh',
        padding: 'var(--gutter)',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      {/* No PageNav here — the splash forwards itself to /interview. */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1>{t('splash.title')}</h1>
        <p>{t('splash.loading', { progress })}</p>
        <progress value={progress} max={100} />
      </div>
    </main>
  )
}

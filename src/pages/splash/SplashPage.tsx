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

  // The bootstrap bar runs for about a second and a half — enough to pull every
  // avatar into the buffer cache, so the selection screen behind it paints
  // finished faces instead of placeholders.
  useEffect(() => {
    prefetchRiveBuffers(INTERVIEWERS.map((profile) => riveAssetUrl(profile.riveFile)))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 10, 100)
        if (next === 100) {
          clearInterval(interval)
          setTimeout(() => navigate('/interview'), 300)
        }
        return next
      })
    }, 150)
    return () => clearInterval(interval)
  }, [navigate])

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

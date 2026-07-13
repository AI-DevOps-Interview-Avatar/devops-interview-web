import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'

/**
 * Заглушка bootstrap-екрану моделі. Реальне завантаження .task бандла
 * та кешування через Cache API/IndexedDB — DIA-97/DIA-98.
 */
export default function SplashPage() {
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()
  const { t } = useTranslation()

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
        height: '100vh',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />
      <div style={{ textAlign: 'center' }}>
        <h1>{t('splash.title')}</h1>
        <p>{t('splash.loading', { progress })}</p>
        <progress value={progress} max={100} />
      </div>
    </main>
  )
}

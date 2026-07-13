import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Заглушка bootstrap-екрану моделі. Реальне завантаження .task бандла
 * та кешування через Cache API/IndexedDB — DIA-97/DIA-98.
 */
export default function SplashPage() {
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()

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
    <main style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>DevOps Interview AI</h1>
        <p>Завантаження моделі… {progress}%</p>
        <progress value={progress} max={100} />
      </div>
    </main>
  )
}

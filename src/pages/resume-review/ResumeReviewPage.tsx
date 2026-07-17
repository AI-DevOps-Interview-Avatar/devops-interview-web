import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import { reviewResume, SAMPLE_RESUME } from '../../domain/resumeReview'

export default function ResumeReviewPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'
  const [text, setText] = useState('')
  const [showSample, setShowSample] = useState(false)
  const [checked, setChecked] = useState(false)

  const result = useMemo(() => reviewResume(text), [text])

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        paddingTop: '4.5rem',
        maxWidth: 760,
        margin: '0 auto',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />
      <PageNav />

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('resumeReview.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('resumeReview.subtitle')}</p>
      </header>

      <button onClick={() => setShowSample((v) => !v)} style={{ marginBottom: '1rem' }}>
        {showSample ? t('resumeReview.hideSample') : t('resumeReview.showSample')}
      </button>

      {showSample && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#1c1d23',
            border: '1px solid #2e303a',
            borderRadius: 12,
            padding: '1rem',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: '1.5rem',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {SAMPLE_RESUME}
        </pre>
      )}

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 14 }}>{t('resumeReview.inputLabel')}</label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setChecked(false)
        }}
        placeholder={t('resumeReview.inputPlaceholder') ?? ''}
        rows={14}
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid #383944',
          background: '#1c1d23',
          color: 'inherit',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />

      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => setChecked(true)} disabled={!text.trim()}>
          {t('resumeReview.checkButton')}
        </button>
      </div>

      {checked && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.75rem' }}>{t('resumeReview.scoreLabel', { score: result.score })}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {result.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 8,
                  border: `1px solid ${item.passed ? '#4CAF50' : '#f87171'}`,
                  background: '#1c1d23',
                }}
              >
                <span>{item.passed ? '✅' : '⚠️'}</span>
                <span>{item[lang]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

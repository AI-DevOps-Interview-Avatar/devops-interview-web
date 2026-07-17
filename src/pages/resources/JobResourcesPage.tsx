import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import { JOB_RESOURCE_CATEGORIES, JOB_SEARCH_TIPS } from '../../domain/jobResources'

export default function JobResourcesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'

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
        <h1 style={{ margin: 0 }}>{t('resources.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('resources.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {JOB_RESOURCE_CATEGORIES.map((category) => (
          <section key={category.id}>
            <h2 style={{ margin: '0 0 0.6rem', fontSize: 18, color: '#c084fc' }}>
              {lang === 'ua' ? category.titleUa : category.titleEn}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {category.items.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid #383944',
                    background: '#2a2b33',
                  }}
                >
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ minWidth: 140, fontWeight: 700, color: '#c084fc' }}
                    >
                      {item.name} ↗
                    </a>
                  ) : (
                    <strong style={{ minWidth: 140 }}>{item.name}</strong>
                  )}
                  <span style={{ color: '#d1d5db' }}>{item[lang]}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 style={{ margin: '0 0 0.6rem', fontSize: 18, color: '#c084fc' }}>{t('resources.tipsTitle')}</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {JOB_SEARCH_TIPS.map((tip, i) => (
              <li key={i}>{tip[lang]}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

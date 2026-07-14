import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'

interface DeveloperLink {
  name: string
  url: string
  icon: string
}

const DEVELOPER_LINKS: DeveloperLink[] = [
  { name: 'GitHub', url: 'https://github.com/AI-DevOps-Interview-Avatar', icon: '🐙' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/alex-d-732900177/', icon: '💼' },
  { name: 'Dev.to', url: 'https://dev.to/oleksandr_devops', icon: '✍️' },
  { name: 'Telegram', url: 'https://t.me/+cO9CESqrxkRjNzJi', icon: '📣' },
]

const ACCENT_STYLE = { '--accent': '#06B6D4' } as CSSProperties

export default function DevelopersPage() {
  const { t } = useTranslation()

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: 760,
        margin: '0 auto',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('developers.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('developers.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {DEVELOPER_LINKS.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card"
            style={{
              ...ACCENT_STYLE,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ fontSize: 22 }}>{link.icon}</span>
            <span style={{ fontWeight: 700 }}>{link.name}</span>
            <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 13 }}>
              {link.url.replace(/^https?:\/\//, '')}
            </span>
          </a>
        ))}
      </div>
    </main>
  )
}

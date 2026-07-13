import { useTranslation } from 'react-i18next'
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n'

const LABELS: Record<SupportedLanguage, string> = {
  en: 'EN',
  ua: 'UA',
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      style={{ display: 'flex', gap: 4, position: 'absolute', top: 16, right: 16, zIndex: 10 }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          aria-pressed={i18n.resolvedLanguage === lang}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #444',
            background: i18n.resolvedLanguage === lang ? '#c084fc' : 'transparent',
            color: i18n.resolvedLanguage === lang ? '#1c1d23' : 'inherit',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n'

const LABELS: Record<SupportedLanguage, string> = {
  en: 'EN',
  ua: 'UA',
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div role="group" aria-label={t('language.label')} className="lang-switcher">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          data-testid={`lang-${lang}`}
          className="lang-switcher__btn"
          onClick={() => setLanguage(lang)}
          aria-pressed={i18n.resolvedLanguage === lang}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  )
}

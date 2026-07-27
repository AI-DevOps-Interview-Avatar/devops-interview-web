import i18n from 'i18next'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'
import { syncDocumentLanguage } from './shared/lib/htmlLang'

export const SUPPORTED_LANGUAGES = ['en', 'ua'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'devops-interview-web:lang'

const storedLanguage = localStorage.getItem(STORAGE_KEY)
const initialLanguage: SupportedLanguage =
  storedLanguage === 'ua' ? 'ua' : 'en' // English is the default regardless of browser locale.

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    backend: {
      loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
    },
    interpolation: {
      escapeValue: false,
    },
  })

// `<html lang>` is static markup, so it kept claiming English through an entire
// Ukrainian session. Track the live language instead of the initial one: the
// switcher is available on every screen.
syncDocumentLanguage(initialLanguage)
i18n.on('languageChanged', syncDocumentLanguage)

export function setLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang)
  void i18n.changeLanguage(lang)
}

export default i18n

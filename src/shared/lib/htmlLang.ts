/**
 * Maps an app language code onto the BCP-47 tag that belongs in `<html lang>`.
 *
 * Our internal code for Ukrainian is "ua" — an ISO 3166 *country* code, not a
 * language one. Assistive technology reads the attribute literally: with
 * `lang="en"` frozen in `index.html`, screen readers pronounced Ukrainian
 * copy with English phonetics, and `lang="ua"` would be no better since no
 * speech engine recognises it. The language subtag is "uk".
 */
const HTML_LANG: Record<string, string> = {
  en: 'en',
  ua: 'uk',
}

const DEFAULT_HTML_LANG = HTML_LANG.en

/** Falls back to English for anything unmapped — an unknown tag is worse than a wrong-but-valid one. */
export function htmlLangFor(language: string | undefined): string {
  if (!language) return DEFAULT_HTML_LANG
  return HTML_LANG[language] ?? DEFAULT_HTML_LANG
}

/** No-op outside a browser (tests, any future SSR pass). */
export function syncDocumentLanguage(language: string | undefined): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = htmlLangFor(language)
}

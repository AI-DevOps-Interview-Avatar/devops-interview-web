import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The locale half of DIA-203, kept out of offerLetter.test.ts because reading a
 * file needs node types and the app's tsconfig deliberately does not have them.
 *
 * It asserts what must not drift between `en/` and `ua/`: the signature is
 * present, it closes the letter, and the facts inside it come from
 * HIRING_CONTACT rather than from a second copy in each translation.
 */
const letterBody = (lang) =>
  JSON.parse(readFileSync(new URL(`../../public/locales/${lang}/translation.json`, import.meta.url), 'utf8')).offer
    .letterBody

const LANGUAGES = ['en', 'ua']

describe('offer letter signature', () => {
  it('leaves the link and the company to code, not to the locale files', () => {
    // Two copies of a URL are two URLs, and they disagree the moment one is
    // edited. The locales carry the sentence; the constant carries the facts.
    for (const lang of LANGUAGES) {
      const body = letterBody(lang)

      expect(body).toContain('{{contactName}}')
      expect(body).toContain('{{contactLinkedIn}}')
      expect(body).toContain('{{company}}')
      expect(body).not.toContain('linkedin.com')
    }
  })

  it('closes both letters with the signature rather than with a greeting', () => {
    for (const lang of LANGUAGES) {
      expect(letterBody(lang).trimEnd().endsWith('{{company}}')).toBe(true)
    }
  })

  it('keeps the same placeholders in both languages', () => {
    // A placeholder that exists in one translation and not the other renders
    // literally for exactly half the users, which is the kind of thing nobody
    // reads the second language closely enough to notice.
    const placeholders = (lang) => [...letterBody(lang).matchAll(/{{(\w+)}}/g)].map(([, name]) => name).sort()

    expect(placeholders('ua')).toEqual(placeholders('en'))
  })
})

import { describe, expect, it } from 'vitest'
import { htmlLangFor } from './htmlLang'

describe('htmlLangFor', () => {
  it('translates the app code "ua" to the language subtag "uk"', () => {
    expect(htmlLangFor('ua')).toBe('uk')
  })

  it('passes English through unchanged', () => {
    expect(htmlLangFor('en')).toBe('en')
  })

  it('falls back to English for unknown or missing codes', () => {
    expect(htmlLangFor('de')).toBe('en')
    expect(htmlLangFor('')).toBe('en')
    expect(htmlLangFor(undefined)).toBe('en')
  })
})

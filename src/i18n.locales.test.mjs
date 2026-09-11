import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The two translation files, held to the same shape.
 *
 * A key present in `en/` and missing from `ua/` does not fail the build, does
 * not fail a type check and does not throw at runtime — i18next falls back to
 * English and the Ukrainian screen quietly grows an English sentence. The
 * acceptance suite catches it only on a screen it happens to open, in the one
 * language it happens to seed. This catches it for every key at once.
 *
 * Written as `.mjs` for the same reason as offerLetter.locales.test.mjs: reading
 * a file needs node types, and the app's tsconfig deliberately does not have
 * them.
 */

const LANGUAGES = ['en', 'ua']

const bundle = (lang) =>
  JSON.parse(readFileSync(new URL(`../public/locales/${lang}/translation.json`, import.meta.url), 'utf8'))

/** Every leaf path in the bundle, e.g. `pro.plans.yearly.name`. */
function leafKeys(node, prefix = '') {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key))
}

describe('en and ua translation bundles', () => {
  it('carry exactly the same keys', () => {
    const [en, ua] = LANGUAGES.map((lang) => leafKeys(bundle(lang)).sort())

    expect(ua.filter((key) => !en.includes(key)), 'only in ua').toEqual([])
    expect(en.filter((key) => !ua.includes(key)), 'only in en').toEqual([])
  })

  it('interpolate the same placeholders in every string', () => {
    // A placeholder that exists in one translation and not the other renders
    // literally for exactly half the users — "{{percent}}" on the price list.
    const en = bundle('en')
    const ua = bundle('ua')
    const placeholders = (text) => [...String(text).matchAll(/{{(\w+)}}/g)].map(([, name]) => name).sort()
    const at = (node, path) => path.split('.').reduce((value, key) => value?.[key], node)

    for (const key of leafKeys(en)) {
      expect(placeholders(at(ua, key)), key).toEqual(placeholders(at(en, key)))
    }
  })

  it('leaves no string empty in either language', () => {
    for (const lang of LANGUAGES) {
      const bundleForLang = bundle(lang)
      const empty = leafKeys(bundleForLang).filter((key) => {
        const value = key.split('.').reduce((node, part) => node?.[part], bundleForLang)
        return typeof value !== 'string' || value.trim() === ''
      })
      expect(empty, `empty in ${lang}`).toEqual([])
    }
  })
})

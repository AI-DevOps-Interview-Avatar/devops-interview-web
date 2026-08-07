import { describe, expect, it } from 'vitest'
import { generateOfferLetter, HIRING_CONTACT } from './offerLetter'

describe('generateOfferLetter', () => {
  it('fills the letter from a fully populated candidate profile', () => {
    const offer = generateOfferLetter({
      candidateName: 'Jane Doe',
      salaryExpectations: '$4000-4500',
      location: 'Kyiv, Ukraine',
      techStackOverview: 'K8s, Terraform, AWS',
    })
    expect(offer.candidateName).toBe('Jane Doe')
    expect(offer.position).toBe('DevOps Engineer')
    expect(offer.salaryExpectations).toBe('$4000-4500')
    expect(offer.location).toBe('Kyiv, Ukraine')
  })

  it('falls back to a placeholder for missing profile fields instead of rendering blank/undefined', () => {
    const offer = generateOfferLetter({})
    expect(offer.candidateName).toBe('—')
    expect(offer.salaryExpectations).toBe('—')
    expect(offer.location).toBe('—')
  })

  it('fills notice period from its own captured profile field', () => {
    const offer = generateOfferLetter({ noticePeriod: '2 weeks' })
    expect(offer.noticePeriod).toBe('2 weeks')
  })

  // A pipeline finished before the name question existed still deserves a
  // readable letter rather than "Dear undefined" — the profile simply has no
  // candidateName, which is the same shape as any unanswered question.
  it('addresses a pre-DIA-135 profile by the placeholder, not by undefined', () => {
    const offer = generateOfferLetter({ salaryExpectations: '$5000' })
    expect(offer.candidateName).toBe('—')
    expect(offer.salaryExpectations).toBe('$5000')
  })

  it('trims a name the candidate dictated with trailing whitespace', () => {
    expect(generateOfferLetter({ candidateName: '  Jane Doe  ' }).candidateName).toBe('Jane Doe')
  })
})

/**
 * The signature is the one part of the letter a candidate is expected to act
 * on, so the details behind it get the same scrutiny as the letter (DIA-203).
 * The locale side of it is checked in offerLetter.locales.test.mjs, which can
 * read the translation files without pulling node types into the app build.
 */
describe('HIRING_CONTACT', () => {
  it('points at a profile the name can be checked against', () => {
    expect(HIRING_CONTACT.linkedIn).toMatch(/^https:\/\/www\.linkedin\.com\/in\/[\w-]+\/?$/)
    expect(HIRING_CONTACT.name.trim()).toBe(HIRING_CONTACT.name)
    expect(HIRING_CONTACT.company).toBeTruthy()
  })
})

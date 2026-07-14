import { describe, expect, it } from 'vitest'
import { generateOfferLetter } from './offerLetter'

describe('generateOfferLetter', () => {
  it('fills the letter from a fully populated candidate profile', () => {
    const offer = generateOfferLetter(
      { salaryExpectations: '$4000-4500', location: 'Kyiv, Ukraine', techStackOverview: 'K8s, Terraform, AWS' },
      'Jane Doe',
    )
    expect(offer.candidateName).toBe('Jane Doe')
    expect(offer.position).toBe('DevOps Engineer')
    expect(offer.salaryExpectations).toBe('$4000-4500')
    expect(offer.location).toBe('Kyiv, Ukraine')
  })

  it('falls back to a placeholder for missing profile fields instead of rendering blank/undefined', () => {
    const offer = generateOfferLetter({}, '')
    expect(offer.candidateName).toBe('—')
    expect(offer.salaryExpectations).toBe('—')
    expect(offer.location).toBe('—')
  })

  it('fills notice period from its own captured profile field', () => {
    const offer = generateOfferLetter({ noticePeriod: '2 weeks' }, 'John Smith')
    expect(offer.noticePeriod).toBe('2 weeks')
  })
})

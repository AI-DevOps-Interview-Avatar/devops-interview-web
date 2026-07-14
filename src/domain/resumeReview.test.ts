import { describe, expect, it } from 'vitest'
import { reviewResume, SAMPLE_RESUME } from './resumeReview'

describe('reviewResume', () => {
  it('flags an empty resume as failing most checks', () => {
    const result = reviewResume('')
    expect(result.score).toBeLessThan(50)
    expect(result.items.find((i) => i.id === 'length')?.passed).toBe(false)
  })

  it('catches the "1 years" number-agreement slip in the sample resume', () => {
    const result = reviewResume(SAMPLE_RESUME)
    const grammarCheck = result.items.find((i) => i.id === 'grammar-years')
    expect(grammarCheck?.passed).toBe(false)
  })

  it('recognizes DevOps keywords, sections, and links in the sample resume', () => {
    const result = reviewResume(SAMPLE_RESUME)
    expect(result.items.find((i) => i.id === 'skills-section')?.passed).toBe(true)
    expect(result.items.find((i) => i.id === 'experience-section')?.passed).toBe(true)
    expect(result.items.find((i) => i.id === 'education-section')?.passed).toBe(true)
    expect(result.items.find((i) => i.id === 'contact-links')?.passed).toBe(true)
    expect(result.items.find((i) => i.id === 'quantified-achievements')?.passed).toBe(true)
    expect(result.items.find((i) => i.id === 'devops-keywords')?.passed).toBe(true)
  })

  it('scores a well-formed resume higher than an empty one', () => {
    expect(reviewResume(SAMPLE_RESUME).score).toBeGreaterThan(reviewResume('').score)
  })
})

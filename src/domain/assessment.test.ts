import { describe, expect, it } from 'vitest'
import { sessionLevel } from './assessment'
import type { BankQuestion, QuestionLevel } from './models/questionBank'

function questions(...levels: QuestionLevel[]): BankQuestion[] {
  return levels.map((level, index) => ({
    id: `q${index}`,
    category: 'linux',
    level,
    ua: `Питання ${index}`,
    en: `Question ${index}`,
  }))
}

describe('sessionLevel', () => {
  it('reports the level a uniform set was drawn from', () => {
    expect(sessionLevel(questions('middle', 'middle', 'middle'))).toBe('middle')
  })

  it('does not let the first draw decide a mixed session', () => {
    // Marcus's pool mixes junior theory with his own middle-level questions;
    // labelling by questions[0] made the history entry a coin toss.
    expect(sessionLevel(questions('junior', 'middle', 'middle'))).toBe('middle')
    expect(sessionLevel(questions('middle', 'junior', 'junior'))).toBe('junior')
  })

  it('rounds a tie up to the more senior level', () => {
    expect(sessionLevel(questions('junior', 'middle'))).toBe('middle')
    expect(sessionLevel(questions('middle', 'senior'))).toBe('senior')
  })

  it('falls back to junior for an empty session rather than throwing', () => {
    expect(sessionLevel([])).toBe('junior')
  })
})

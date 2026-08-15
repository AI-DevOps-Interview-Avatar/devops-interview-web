import { describe, expect, it } from 'vitest'
import { assessSession, sessionLevel } from './assessment'
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

describe('assessSession with generated remarks in the transcript', () => {
  it('counts questions asked, not everything the interviewer said', () => {
    // A remark is the interviewer talking, and it is not a question. Counting it
    // would inflate `askedCount` past the number of questions in the session and
    // pull unrelated categories into the summary.
    const selected = questions('junior', 'middle')
    const assessment = assessSession(
      [
        { author: 'interviewer', greeting: true },
        { author: 'interviewer', questionIndex: 0 },
        { author: 'user', text: 'three stages and a shared cache' },
        { author: 'interviewer', remark: 'Sensible split — what broke first?', lang: 'en' },
        { author: 'user', text: 'the cache did' },
      ],
      selected,
    )

    expect(assessment.askedCount).toBe(1)
    expect(assessment.answeredCount).toBe(2)
    expect(assessment.categories).toEqual(['linux'])
  })
})

import { describe, expect, it } from 'vitest'
import { QUIZ_QUESTIONS, scoreQuiz } from './quizBank'

describe('QUIZ_QUESTIONS', () => {
  it('gives every question exactly 3 options with a valid correctIndex', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(3)
    }
  })

  it('has unique question ids', () => {
    const ids = QUIZ_QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('scoreQuiz', () => {
  it('scores 100% when every answer matches correctIndex', () => {
    const answers = QUIZ_QUESTIONS.map((q) => q.correctIndex)
    const result = scoreQuiz(QUIZ_QUESTIONS, answers)
    expect(result.correct).toBe(QUIZ_QUESTIONS.length)
    expect(result.percentage).toBe(100)
  })

  it('scores 0% when every answer is wrong or skipped', () => {
    const answers = QUIZ_QUESTIONS.map(() => undefined)
    const result = scoreQuiz(QUIZ_QUESTIONS, answers)
    expect(result.correct).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it('computes a partial percentage for a mix of right/wrong answers', () => {
    const questions = QUIZ_QUESTIONS.slice(0, 4)
    const answers = [questions[0].correctIndex, questions[1].correctIndex, undefined, undefined]
    const result = scoreQuiz(questions, answers)
    expect(result.correct).toBe(2)
    expect(result.total).toBe(4)
    expect(result.percentage).toBe(50)
  })
})

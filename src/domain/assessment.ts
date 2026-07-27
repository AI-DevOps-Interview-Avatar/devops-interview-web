import type { BankQuestion, QuestionLevel } from './models/questionBank'
import type { ChatMessage } from '../store/interviewSlice'

/** Junior → senior. Order matters: ties in `sessionLevel` resolve upward. */
const LEVEL_ORDER: QuestionLevel[] = ['junior', 'middle', 'senior']

/**
 * The level a finished session is recorded under in history.
 *
 * Reading it off the first question was accurate while every pool held a single
 * level. Marcus's pool now mixes junior theory with his own middle-level
 * questions, so the first draw would label the whole session at random. Takes
 * the level that occurs most instead, and the more senior one on a tie.
 */
export function sessionLevel(questions: BankQuestion[]): QuestionLevel {
  const counts = new Map<QuestionLevel, number>()
  for (const question of questions) {
    counts.set(question.level, (counts.get(question.level) ?? 0) + 1)
  }

  let best: QuestionLevel = 'junior'
  let bestCount = 0
  for (const level of LEVEL_ORDER) {
    const count = counts.get(level) ?? 0
    if (count > 0 && count >= bestCount) {
      best = level
      bestCount = count
    }
  }
  return best
}

export interface SessionAssessment {
  askedCount: number
  answeredCount: number
  /** Share of the session completed (answeredCount / MAX_QUESTIONS), 0-100. */
  completionRate: number
  /** Average answer length in words — a rough effort/depth proxy, not a correctness score. */
  avgAnswerWords: number
  categories: string[]
}

/**
 * There is no real LLM grading yet (DIA-84) — this is a transparent rubric,
 * not a claim about answer correctness or DevOps skill. It only measures
 * what can be measured without inference: how much of the session was
 * completed and how much the candidate wrote per answer.
 */
export function assessSession(messages: ChatMessage[], selectedQuestions: BankQuestion[]): SessionAssessment {
  const askedCount = messages.filter((m) => m.author === 'interviewer' && 'questionIndex' in m).length
  const userAnswers = messages.filter((m) => m.author === 'user')
  const answeredCount = userAnswers.length

  const totalWords = userAnswers.reduce((sum, m) => {
    const text = m.author === 'user' ? m.text : ''
    return sum + text.trim().split(/\s+/).filter(Boolean).length
  }, 0)
  const avgAnswerWords = answeredCount > 0 ? Math.round(totalWords / answeredCount) : 0
  const completionRate = selectedQuestions.length > 0 ? Math.round((answeredCount / selectedQuestions.length) * 100) : 0
  const categories = Array.from(new Set(selectedQuestions.slice(0, askedCount).map((q) => q.category)))

  return { askedCount, answeredCount, completionRate, avgAnswerWords, categories }
}

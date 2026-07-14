import type { BankQuestion } from './models/questionBank'
import type { ChatMessage } from '../store/interviewSlice'

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

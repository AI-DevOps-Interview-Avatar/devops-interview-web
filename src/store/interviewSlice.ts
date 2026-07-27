import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BankQuestion } from '../domain/models/questionBank'

/** Default question count for standalone practice sessions (shuffled bank subset). Pipeline stages use their own fixed-length script instead. */
export const MAX_QUESTIONS = 5

export type ChatMessage =
  | { author: 'user'; text: string }
  /** `questionIndex` into `selectedQuestions` (not raw text) so switching UI language re-translates past turns. */
  | { author: 'interviewer'; questionIndex: number }
  /** The persona's opening self-introduction, looked up via i18n at render time so it also re-translates. */
  | { author: 'interviewer'; greeting: true }

interface InterviewState {
  interviewerId: string | null
  /** The subset (random for practice, fixed script for pipeline stages) of the persona's questions picked for this session. */
  selectedQuestions: BankQuestion[]
  messages: ChatMessage[]
  questionCount: number
  finished: boolean
  /**
   * Question the UI has been told to produce, or null when idle. Doubles as the
   * in-flight lock: the reducer owns which question comes next, so a caller
   * holding a stale render snapshot can no longer name the index itself.
   */
  pendingQuestionIndex: number | null
}

const initialState: InterviewState = {
  interviewerId: null,
  selectedQuestions: [],
  messages: [],
  questionCount: 0,
  finished: false,
  pendingQuestionIndex: null,
}

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    startInterview(state, action: PayloadAction<{ interviewerId: string; questions: BankQuestion[] }>) {
      state.interviewerId = action.payload.interviewerId
      state.selectedQuestions = action.payload.questions
      state.messages = []
      state.questionCount = 0
      state.finished = false
      state.pendingQuestionIndex = null
    },
    /**
     * "Move the interview forward" — an intent, not an index. Callers used to
     * pass the question number they had read off their own render snapshot,
     * so a speech transcript flushing late could name a question that had
     * already been asked and get it a second time. The next index is derived
     * here from committed state instead, and only one request can be open.
     */
    requestNextQuestion(state) {
      if (state.finished || state.pendingQuestionIndex !== null) return
      if (state.questionCount >= state.selectedQuestions.length) return
      state.pendingQuestionIndex = state.questionCount
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      const message = action.payload
      if (message.author === 'interviewer' && 'questionIndex' in message) {
        // Idempotent by index. Anything out of step — a duplicate, or a
        // generation that finished after the session moved on to Summary — is
        // dropped rather than appended.
        if (state.finished || message.questionIndex !== state.questionCount) return
        state.messages.push(message)
        state.questionCount += 1
        state.pendingQuestionIndex = null
        return
      }

      state.messages.push(message)
      if (message.author === 'user' && state.questionCount >= state.selectedQuestions.length) {
        // Only finish once the candidate has answered the last question —
        // otherwise the input box would vanish right as the last one is asked.
        state.finished = true
      }
    },
  },
})

export const { startInterview, addMessage, requestNextQuestion } = interviewSlice.actions
export default interviewSlice.reducer

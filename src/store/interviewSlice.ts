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
}

const initialState: InterviewState = {
  interviewerId: null,
  selectedQuestions: [],
  messages: [],
  questionCount: 0,
  finished: false,
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
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload)
      if (action.payload.author === 'interviewer' && 'questionIndex' in action.payload) {
        state.questionCount += 1
      } else if (action.payload.author === 'user' && state.questionCount >= state.selectedQuestions.length) {
        // Only finish once the candidate has answered the last question —
        // otherwise the input box would vanish right as the last one is asked.
        state.finished = true
      }
    },
  },
})

export const { startInterview, addMessage } = interviewSlice.actions
export default interviewSlice.reducer

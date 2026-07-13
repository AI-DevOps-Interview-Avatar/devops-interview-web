import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BankQuestion } from '../domain/models/questionBank'

export const MAX_QUESTIONS = 5

export type ChatMessage =
  | { author: 'user'; text: string }
  /** `questionIndex` into `selectedQuestions` (not raw text) so switching UI language re-translates past turns. */
  | { author: 'interviewer'; questionIndex: number }

interface InterviewState {
  interviewerId: string | null
  /** The random subset of the persona's question bank picked for this session. */
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
      if (action.payload.author === 'interviewer') {
        state.questionCount += 1
      } else if (state.questionCount >= MAX_QUESTIONS) {
        // Only finish once the candidate has answered the last question —
        // otherwise the input box would vanish right as Q5 is asked.
        state.finished = true
      }
    },
  },
})

export const { startInterview, addMessage } = interviewSlice.actions
export default interviewSlice.reducer

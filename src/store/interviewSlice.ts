import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export const MAX_QUESTIONS = 5

export interface ChatMessage {
  author: 'interviewer' | 'user'
  text: string
}

interface InterviewState {
  interviewerId: string | null
  messages: ChatMessage[]
  questionCount: number
  finished: boolean
}

const initialState: InterviewState = {
  interviewerId: null,
  messages: [],
  questionCount: 0,
  finished: false,
}

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    startInterview(state, action: PayloadAction<string>) {
      state.interviewerId = action.payload
      state.messages = []
      state.questionCount = 0
      state.finished = false
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload)
      if (action.payload.author === 'interviewer') {
        state.questionCount += 1
      }
      if (state.questionCount >= MAX_QUESTIONS) {
        state.finished = true
      }
    },
  },
})

export const { startInterview, addMessage } = interviewSlice.actions
export default interviewSlice.reducer

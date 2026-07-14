import { configureStore } from '@reduxjs/toolkit'
import interviewReducer from './interviewSlice'
import pipelineReducer, { savePipelineState } from './pipelineSlice'

export const store = configureStore({
  reducer: {
    interview: interviewReducer,
    pipeline: pipelineReducer,
  },
})

// Persist pipeline progress (unlike practice-mode interview state) so a
// reload/direct URL entry mid-pipeline doesn't strand the candidate back at Stage 1.
store.subscribe(() => savePipelineState(store.getState().pipeline))

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

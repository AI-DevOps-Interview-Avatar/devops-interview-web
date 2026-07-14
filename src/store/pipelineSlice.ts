import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BankQuestion } from '../domain/models/questionBank'
import type { ChatMessage } from './interviewSlice'
import type { CandidateProfile } from '../domain/pipeline'

export interface PipelineState {
  completedStages: number[]
  candidateProfile: CandidateProfile
}

function emptyState(): PipelineState {
  return { completedStages: [], candidateProfile: {} }
}

const STORAGE_KEY = 'devops-interview-web:pipeline'

/**
 * Pipeline progress survives a full page reload/direct URL entry (unlike
 * the practice-mode interviewSlice) — a candidate mid-way through a real
 * 5-stage hiring flow shouldn't lose everything on an accidental refresh.
 * Same plain-localStorage approach as historySlice.ts, no store middleware.
 */
function loadInitialState(): PipelineState {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<PipelineState>
    return {
      completedStages: Array.isArray(parsed.completedStages) ? parsed.completedStages : [],
      candidateProfile: parsed.candidateProfile ?? {},
    }
  } catch {
    return emptyState()
  }
}

export function savePipelineState(state: PipelineState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState: loadInitialState(),
  reducers: {
    completeStage(
      state,
      action: PayloadAction<{ stageIndex: number; selectedQuestions: BankQuestion[]; messages: ChatMessage[] }>,
    ) {
      const { stageIndex, selectedQuestions, messages } = action.payload
      if (!state.completedStages.includes(stageIndex)) {
        state.completedStages.push(stageIndex)
      }
      // Pair each profileField-tagged question with the candidate's next answer.
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        if (m.author !== 'interviewer' || !('questionIndex' in m)) continue
        const question = selectedQuestions[m.questionIndex]
        if (!question?.profileField) continue
        const next = messages[i + 1]
        if (next?.author === 'user') {
          state.candidateProfile[question.profileField] = next.text
        }
      }
    },
    resetPipeline() {
      return emptyState()
    },
  },
})

export const { completeStage, resetPipeline } = pipelineSlice.actions
export default pipelineSlice.reducer

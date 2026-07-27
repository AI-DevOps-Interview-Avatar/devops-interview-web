import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BankQuestion } from '../domain/models/questionBank'
import type { ChatMessage } from './interviewSlice'
import type { CandidateProfile } from '../domain/pipeline'
import { isWithinRetention, STORAGE_PREFIX } from './localData'

export interface PipelineState {
  completedStages: number[]
  candidateProfile: CandidateProfile
}

/** What actually goes to disk: the state plus the timestamp retention is measured from. */
type PersistedPipeline = Partial<PipelineState> & { savedAt?: string }

function emptyState(): PipelineState {
  return { completedStages: [], candidateProfile: {} }
}

export function isEmptyPipeline(state: PipelineState): boolean {
  return state.completedStages.length === 0 && Object.keys(state.candidateProfile).length === 0
}

const STORAGE_KEY = `${STORAGE_PREFIX}pipeline`

/**
 * Pipeline progress survives a full page reload/direct URL entry (unlike
 * the practice-mode interviewSlice) — a candidate mid-way through a real
 * 5-stage hiring flow shouldn't lose everything on an accidental refresh.
 * Same plain-localStorage approach as historySlice.ts, no store middleware.
 *
 * It is also the most sensitive thing we keep: `candidateProfile` holds the
 * candidate's own words on salary, notice period and current employer. It
 * expires on the same schedule as history, and a payload written before this
 * policy existed (no `savedAt`) is grandfathered in rather than deleted.
 */
function loadInitialState(): PipelineState {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as PersistedPipeline
    if (!isWithinRetention(parsed.savedAt)) {
      localStorage.removeItem(STORAGE_KEY)
      return emptyState()
    }
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
  // Nothing worth remembering. Removing beats writing an empty record: this
  // runs on every store update, so otherwise the key would reappear a tick
  // after "Clear my data" wiped it.
  if (isEmptyPipeline(state)) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const payload: PersistedPipeline = { ...state, savedAt: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
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

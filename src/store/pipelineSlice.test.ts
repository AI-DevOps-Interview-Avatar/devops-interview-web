import { afterEach, describe, expect, it, vi } from 'vitest'
import pipelineReducer, { completeStage, resetPipeline, savePipelineState } from './pipelineSlice'
import { canEnterStage } from '../domain/pipeline'
import type { ChatMessage } from './interviewSlice'
import { RECRUITER_STAGE1_QUESTIONS } from '../domain/models/questionBank'
import { RETENTION_DAYS } from './localData'
import { localStorageStub } from '../test/localStorageStub'

const PIPELINE_KEY = 'devops-interview-web:pipeline'

const initialState = pipelineReducer(undefined, { type: '@@INIT' })

describe('pipelineSlice: stage-machine transitions', () => {
  it('starts with no stages completed, so only Stage 1 is reachable', () => {
    expect(initialState.completedStages).toEqual([])
    expect(canEnterStage(initialState.completedStages, 0)).toBe(true)
    expect(canEnterStage(initialState.completedStages, 1)).toBe(false)
  })

  it('completing Stage 1 unlocks Stage 2 but still blocks Stage 3', () => {
    const afterStage1 = pipelineReducer(
      initialState,
      completeStage({ stageIndex: 0, selectedQuestions: RECRUITER_STAGE1_QUESTIONS, messages: [] }),
    )
    expect(afterStage1.completedStages).toEqual([0])
    expect(canEnterStage(afterStage1.completedStages, 1)).toBe(true)
    expect(canEnterStage(afterStage1.completedStages, 2)).toBe(false)
  })

  it('does not duplicate a stage index if completeStage fires twice for the same stage', () => {
    const once = pipelineReducer(initialState, completeStage({ stageIndex: 0, selectedQuestions: [], messages: [] }))
    const twice = pipelineReducer(once, completeStage({ stageIndex: 0, selectedQuestions: [], messages: [] }))
    expect(twice.completedStages).toEqual([0])
  })

  it('resetPipeline clears completed stages and the candidate profile', () => {
    const dirty = pipelineReducer(initialState, completeStage({ stageIndex: 0, selectedQuestions: [], messages: [] }))
    const reset = pipelineReducer(dirty, resetPipeline())
    expect(reset.completedStages).toEqual([])
    expect(reset.candidateProfile).toEqual({})
  })
})

describe('pipelineSlice: candidate profile capture (feeds the Stage 5 offer letter)', () => {
  it('captures the answer immediately following a profileField-tagged question', () => {
    const salaryQuestionIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-salary')
    const locationQuestionIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-location')

    const messages: ChatMessage[] = [
      { author: 'interviewer', greeting: true },
      { author: 'interviewer', questionIndex: salaryQuestionIndex },
      { author: 'user', text: '$4000-4500, one month notice' },
      { author: 'interviewer', questionIndex: locationQuestionIndex },
      { author: 'user', text: 'Kyiv, Ukraine' },
    ]

    const state = pipelineReducer(
      initialState,
      completeStage({ stageIndex: 0, selectedQuestions: RECRUITER_STAGE1_QUESTIONS, messages }),
    )

    expect(state.candidateProfile.salaryExpectations).toBe('$4000-4500, one month notice')
    expect(state.candidateProfile.location).toBe('Kyiv, Ukraine')
  })

  // DIA-135: the name used to be typed into the offer page after the fact. It
  // now rides the same capture path as salary and location, which means the
  // offer letter is addressed correctly without the candidate doing anything
  // beyond answering Emma's first question.
  it('captures the candidate name from the opening question of the script', () => {
    const nameIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-name')
    const messages: ChatMessage[] = [
      { author: 'interviewer', greeting: true },
      { author: 'interviewer', questionIndex: nameIndex },
      { author: 'user', text: 'Jane Doe' },
    ]
    const state = pipelineReducer(
      initialState,
      completeStage({ stageIndex: 0, selectedQuestions: RECRUITER_STAGE1_QUESTIONS, messages }),
    )
    expect(state.candidateProfile.candidateName).toBe('Jane Doe')
  })

  it('leaves the name unset when the candidate skipped the question, rather than storing the greeting', () => {
    const nameIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-name')
    const aboutIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-about')
    const messages: ChatMessage[] = [
      { author: 'interviewer', questionIndex: nameIndex },
      { author: 'interviewer', questionIndex: aboutIndex },
      { author: 'user', text: 'I have been doing DevOps for four years.' },
    ]
    const state = pipelineReducer(
      initialState,
      completeStage({ stageIndex: 0, selectedQuestions: RECRUITER_STAGE1_QUESTIONS, messages }),
    )
    expect(state.candidateProfile.candidateName).toBeUndefined()
  })

  it('ignores questions without a profileField tag', () => {
    const motivationIndex = RECRUITER_STAGE1_QUESTIONS.findIndex((q) => q.id === 'stage1-motivation')
    const messages: ChatMessage[] = [
      { author: 'interviewer', questionIndex: motivationIndex },
      { author: 'user', text: 'Looking for new challenges.' },
    ]
    const state = pipelineReducer(
      initialState,
      completeStage({ stageIndex: 0, selectedQuestions: RECRUITER_STAGE1_QUESTIONS, messages }),
    )
    expect(state.candidateProfile).toEqual({})
  })
})

// The candidate profile is the most personal thing this app keeps — free text
// on salary, notice period and current employer, on a public site that may be
// running on a shared machine.
describe('pipelineSlice: local data retention', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** Re-imports the slice so its module-level loader runs against `storage`. */
  async function loadSliceWith(stored: unknown) {
    const storage = localStorageStub({ [PIPELINE_KEY]: JSON.stringify(stored) })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const module = await import('./pipelineSlice')
    return { storage, state: module.default(undefined, { type: '@@INIT' }) }
  }

  it('restores progress saved inside the retention window', async () => {
    const savedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { state } = await loadSliceWith({
      completedStages: [0, 1],
      candidateProfile: { salaryExpectations: '$4500' },
      savedAt,
    })
    expect(state.completedStages).toEqual([0, 1])
    expect(state.candidateProfile.salaryExpectations).toBe('$4500')
  })

  it('discards — and deletes — progress that has outlived the window', async () => {
    const savedAt = new Date(Date.now() - (RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    const { storage, state } = await loadSliceWith({
      completedStages: [0, 1],
      candidateProfile: { salaryExpectations: '$4500' },
      savedAt,
    })
    expect(state.completedStages).toEqual([])
    expect(state.candidateProfile).toEqual({})
    expect(storage.getItem(PIPELINE_KEY)).toBeNull()
  })

  it('keeps progress written before the policy existed, rather than deleting it blind', async () => {
    const { state } = await loadSliceWith({ completedStages: [0], candidateProfile: {} })
    expect(state.completedStages).toEqual([0])
  })

  it('removes the key instead of persisting an empty pipeline, so a cleared state stays cleared', () => {
    const storage = localStorageStub({ [PIPELINE_KEY]: '{"completedStages":[0]}' })
    vi.stubGlobal('localStorage', storage)

    savePipelineState({ completedStages: [], candidateProfile: {} })

    expect(storage.getItem(PIPELINE_KEY)).toBeNull()
  })

  it('stamps every save so the clock starts at the last activity, not the first', () => {
    const storage = localStorageStub()
    vi.stubGlobal('localStorage', storage)

    savePipelineState({ completedStages: [0], candidateProfile: {} })

    const saved = JSON.parse(storage.getItem(PIPELINE_KEY)!) as { savedAt?: string }
    expect(saved.savedAt).toBeTypeOf('string')
    expect(Number.isNaN(Date.parse(saved.savedAt!))).toBe(false)
  })
})

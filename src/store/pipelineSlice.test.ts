import { describe, expect, it } from 'vitest'
import pipelineReducer, { completeStage, resetPipeline } from './pipelineSlice'
import { canEnterStage } from '../domain/pipeline'
import type { ChatMessage } from './interviewSlice'
import { RECRUITER_STAGE1_QUESTIONS } from '../domain/models/questionBank'

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

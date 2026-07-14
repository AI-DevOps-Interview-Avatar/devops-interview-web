import { describe, expect, it } from 'vitest'
import { canEnterStage, PIPELINE_STAGES, OFFER_STAGE_INDEX } from './pipeline'

describe('PIPELINE_STAGES', () => {
  it('defines the 5 stages in the required Emma → Marcus → David → Olivia → Offer order', () => {
    expect(PIPELINE_STAGES.map((s) => s.interviewerId)).toEqual(['recruiter', 'senior-devops', 'cto', 'hr', null])
    expect(OFFER_STAGE_INDEX).toBe(4)
  })
})

describe('canEnterStage', () => {
  it('always allows Stage 1 (screening)', () => {
    expect(canEnterStage([], 0)).toBe(true)
  })

  it('blocks skipping straight from Stage 1 to Stage 3 (live coding) without completing Stage 2', () => {
    // Only stage 0 (screening) completed — stage 2 (live-coding, index 2) must stay locked.
    expect(canEnterStage([0], 2)).toBe(false)
  })

  it('unlocks a stage once every prior stage is completed, in order', () => {
    expect(canEnterStage([0], 1)).toBe(true)
    expect(canEnterStage([0, 1], 2)).toBe(true)
    expect(canEnterStage([0, 1, 2], 3)).toBe(true)
    expect(canEnterStage([0, 1, 2, 3], OFFER_STAGE_INDEX)).toBe(true)
  })

  it('does not unlock out of order even if a later stage is (incorrectly) marked complete', () => {
    // Completed stage 2 but not stage 1 — stage 3 must still be unreachable.
    expect(canEnterStage([0, 2], 3)).toBe(false)
  })

  it('rejects out-of-range stage indices', () => {
    expect(canEnterStage([0, 1, 2, 3], -1)).toBe(false)
    expect(canEnterStage([0, 1, 2, 3], PIPELINE_STAGES.length)).toBe(false)
  })
})

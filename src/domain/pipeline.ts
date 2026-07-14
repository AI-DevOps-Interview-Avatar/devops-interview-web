import type { CandidateProfileField } from './models/questionBank'

export type PipelineStageKey = 'screening' | 'technical-screening' | 'live-coding' | 'cultural-fit' | 'offer'

export interface PipelineStageDef {
  key: PipelineStageKey
  /** null for the Stage 5 offer step — it has no interviewer persona. */
  interviewerId: string | null
  titleKey: string
}

/** The 5-stage hiring pipeline, in enforced order. Index = stage number - 1. */
export const PIPELINE_STAGES: PipelineStageDef[] = [
  { key: 'screening', interviewerId: 'recruiter', titleKey: 'pipeline.stages.screening' },
  { key: 'technical-screening', interviewerId: 'senior-devops', titleKey: 'pipeline.stages.technicalScreening' },
  { key: 'live-coding', interviewerId: 'cto', titleKey: 'pipeline.stages.liveCoding' },
  { key: 'cultural-fit', interviewerId: 'hr', titleKey: 'pipeline.stages.culturalFit' },
  { key: 'offer', interviewerId: null, titleKey: 'pipeline.stages.offer' },
]

export const OFFER_STAGE_INDEX = PIPELINE_STAGES.length - 1

export type CandidateProfile = Partial<Record<CandidateProfileField, string>>

/** A stage is reachable only once every prior stage has been completed — no skipping ahead. */
export function canEnterStage(completedStages: number[], stageIndex: number): boolean {
  if (stageIndex === 0) return true
  if (stageIndex < 0 || stageIndex >= PIPELINE_STAGES.length) return false
  for (let i = 0; i < stageIndex; i++) {
    if (!completedStages.includes(i)) return false
  }
  return true
}

import { describe, expect, it } from 'vitest'
import { PIPELINE_QUESTION_SETS } from './questionBank'

describe('PIPELINE_QUESTION_SETS: question delivery per persona', () => {
  it("delivers Marcus's (senior-devops) DevOps blitz screening questions at Stage 2", () => {
    const marcusIds = PIPELINE_QUESTION_SETS['senior-devops'].map((q) => q.id)
    expect(marcusIds).toEqual(
      expect.arrayContaining(['stage2-inodes', 'stage2-tcp-udp', 'stage2-git', 'stage2-docker', 'stage2-cicd', 'stage2-vpc']),
    )
  })

  it("delivers David's (cto) live-coding/YAML/troubleshooting tasks at Stage 3", () => {
    const davidQuestions = PIPELINE_QUESTION_SETS.cto
    const categories = davidQuestions.map((q) => q.category)
    expect(categories).toEqual(expect.arrayContaining(['live-coding', 'yaml-analysis', 'troubleshooting', 'take-home']))
    expect(davidQuestions.every((q) => q.isTaskPrompt)).toBe(true)
  })

  it("does not deliver David's technical/live-coding tasks to Emma's (recruiter) Stage 1 screening", () => {
    const emmaQuestions = PIPELINE_QUESTION_SETS.recruiter
    const technicalCategories = ['live-coding', 'yaml-analysis', 'troubleshooting']
    expect(emmaQuestions.some((q) => technicalCategories.includes(q.category))).toBe(false)
  })

  it("delivers Olivia's (Project Manager, id 'hr') cultural-fit questions at Stage 4", () => {
    const oliviaIds = PIPELINE_QUESTION_SETS.hr.map((q) => q.id)
    expect(oliviaIds).toEqual(['stage4-conflict', 'stage4-pressure', 'stage4-prioritization', 'stage4-growth'])
  })
})

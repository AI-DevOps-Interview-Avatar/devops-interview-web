import { describe, expect, it } from 'vitest'
import { PIPELINE_QUESTION_SETS, QUESTION_BANKS, RECRUITER_STAGE1_QUESTIONS } from './questionBank'

describe('Emma (recruiter) asks her screening script and nothing else', () => {
  /** The agreed script, in order. Changing the recruiter's questions means changing this list. */
  const SCRIPT = [
    'stage1-last-project',
    'stage1-tech-stack',
    'stage1-fop-readiness',
    'stage1-military-status',
    'stage1-location',
    'stage1-salary',
    'stage1-notice-period',
    'stage1-english-check',
    'stage1-motivation',
    'stage1-prioritization',
    'stage1-team-size',
    'stage1-cloud-platforms',
    'stage1-containers',
    'stage1-cicd-tools',
    'stage1-observability',
    'stage1-scripting',
    'stage1-devsecops',
    'stage1-english-level',
  ]

  it('asks exactly the script, in order, in the pipeline', () => {
    expect(PIPELINE_QUESTION_SETS.recruiter.map((q) => q.id)).toEqual(SCRIPT)
  })

  it('draws practice questions from the same script — there is no second source', () => {
    // Practice shuffles and trims, so only membership can be asserted; the point
    // is that no question outside the script can ever be drawn.
    expect(QUESTION_BANKS.recruiter.map((q) => q.id).sort()).toEqual([...SCRIPT].sort())
    expect(QUESTION_BANKS.recruiter).toBe(RECRUITER_STAGE1_QUESTIONS)
  })

  it('carries no leftover technical theory from the old practice bank', () => {
    // The bank used to hold inodes, swappiness and the Linux boot sequence,
    // which contradicted both Emma's profile description and her greeting.
    const banned = ['linux', 'networks', 'development', 'practical', 'live-coding']
    expect(QUESTION_BANKS.recruiter.filter((q) => banned.includes(q.category))).toEqual([])
  })

  it('keeps every field the offer letter reads from Stage 1', () => {
    const captured = RECRUITER_STAGE1_QUESTIONS.flatMap((q) => (q.profileField ? [q.profileField] : []))
    expect(captured).toEqual(
      expect.arrayContaining(['techStackOverview', 'location', 'salaryExpectations', 'noticePeriod']),
    )
  })
})

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

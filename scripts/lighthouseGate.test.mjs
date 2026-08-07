import { describe, expect, it } from 'vitest'
import { checkScores, ROUTES, THRESHOLDS, thresholdsFor } from './lighthouseGate.mjs'

/** A run that clears every threshold, used as the base for each breach below. */
const passing = [
  { url: '/', scores: { performance: 0.99, accessibility: 1, 'best-practices': 1, seo: 1 } },
  { url: '/interview', scores: { performance: 0.92, accessibility: 1, 'best-practices': 1, seo: 1 } },
]

describe('checkScores', () => {
  it('passes a run that clears every threshold', () => {
    expect(checkScores(passing)).toEqual([])
  })

  it('fails an accessibility regression, naming the route it happened on', () => {
    const runs = [passing[0], { ...passing[1], scores: { ...passing[1].scores, accessibility: 0.92 } }]

    const [failure] = checkScores(runs)
    expect(failure).toContain('/interview')
    expect(failure).toContain('accessibility')
    expect(failure).toContain('92')
  })

  it('reports every breach, not just the first', () => {
    const broken = { performance: 0.1, accessibility: 0.5, 'best-practices': 0.5, seo: 0.5 }

    expect(checkScores([{ url: '/', scores: broken }])).toHaveLength(4)
  })

  it('treats a category that errored as a failure rather than a pass', () => {
    // Lighthouse scores a category `null` when its audits could not run. Left
    // unhandled that compares as falsy in some checks and slips through others,
    // which is how a gate quietly stops gating.
    const runs = [{ url: '/', scores: { ...passing[0].scores, seo: null } }]

    const [failure] = checkScores(runs)
    expect(failure).toContain('did not produce a score')
  })

  it('fails loudly when handed no runs at all', () => {
    expect(checkScores([])[0]).toContain('not looking at a real build')
  })

  it('holds performance looser than the deterministic categories', () => {
    // Not a preference — a strict performance number on shared CI hardware
    // fails builds that changed nothing, and a gate people re-run on red is
    // not a gate. The comment block in lighthouseGate.mjs explains the split.
    expect(THRESHOLDS.performance).toBeLessThan(THRESHOLDS.accessibility)
    expect(THRESHOLDS.accessibility).toBe(1)
  })

  it('measures the routes a candidate actually lands on', () => {
    expect(ROUTES).toContain('/')
    expect(ROUTES.every((route) => route.startsWith('/'))).toBe(true)
  })
})

describe('thresholdsFor', () => {
  it('enforces all four categories on CI', () => {
    expect(thresholdsFor({ CI: 'true' })).toEqual(THRESHOLDS)
  })

  it('drops performance off a developer machine, keeping the deterministic three', () => {
    // A laptop scores 50-60 on the avatar screens where the runner scores
    // 86-88, so the CI floor would be red locally on every single run.
    const local = thresholdsFor({})

    expect(local.performance).toBeUndefined()
    expect(local).toEqual({ accessibility: 1, 'best-practices': 1, seo: 1 })
  })

  it('still fails a local run on an accessibility regression', () => {
    // The point of dropping performance is that it is hardware-dependent, not
    // that local runs stop gating anything.
    const runs = [{ url: '/', scores: { performance: 0.5, accessibility: 0.9, 'best-practices': 1, seo: 1 } }]

    const failures = checkScores(runs, thresholdsFor({}))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('accessibility')
  })
})

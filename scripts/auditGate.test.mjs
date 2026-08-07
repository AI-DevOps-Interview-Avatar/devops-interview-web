import { describe, expect, it } from 'vitest'
import { ALLOWLIST, evaluateAudit, findAdvisories } from './auditGate.mjs'

/** The shape `npm audit --json` produces for one advisory affecting a package and its dependent. */
function report(...advisories) {
  const vulnerabilities = {}
  for (const advisory of advisories) {
    vulnerabilities[advisory.name] = { name: advisory.name, severity: advisory.severity, via: [advisory] }
    // npm lists the dependent separately, pointing back by name rather than
    // repeating the advisory — the duplicate a human would not count twice.
    vulnerabilities[`${advisory.name}-dom`] = {
      name: `${advisory.name}-dom`,
      severity: advisory.severity,
      via: [advisory.name],
    }
  }
  return { vulnerabilities }
}

const rscCsrf = {
  name: 'react-router',
  severity: 'high',
  title: 'React Router: RSC Mode CSRF Bypass',
  url: 'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
  source: 1108000,
}

const unknownHigh = {
  name: 'left-pad',
  severity: 'high',
  title: 'Something nobody has looked at',
  url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
  source: 42,
}

describe('findAdvisories', () => {
  it('counts an advisory once however many packages it reaches', () => {
    expect(findAdvisories(report(rscCsrf))).toEqual([
      {
        id: 'GHSA-qwww-vcr4-c8h2',
        package: 'react-router',
        title: 'React Router: RSC Mode CSRF Bypass',
        severity: 'high',
      },
    ])
  })

  it('ignores moderate and low findings, which are for reading rather than blocking', () => {
    expect(findAdvisories(report({ ...unknownHigh, severity: 'moderate' }))).toEqual([])
  })

  it('treats a clean report as clean rather than throwing', () => {
    expect(findAdvisories({})).toEqual([])
    expect(findAdvisories({ vulnerabilities: {} })).toEqual([])
  })
})

describe('evaluateAudit', () => {
  const allowlist = [{ advisory: 'GHSA-qwww-vcr4-c8h2', package: 'react-router', reviewBy: '2026-10-31', reason: 'x' }]
  const before = new Date('2026-08-01')

  it('passes on an advisory that was reviewed and written down', () => {
    const { failures, allowed } = evaluateAudit(report(rscCsrf), allowlist, before)

    expect(failures).toEqual([])
    expect(allowed).toHaveLength(1)
  })

  it('fails on a high advisory nobody has written down', () => {
    const { failures } = evaluateAudit(report(rscCsrf, unknownHigh), allowlist, before)

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('GHSA-aaaa-bbbb-cccc')
  })

  it('fails once the review date has passed, so an exemption cannot become permanent', () => {
    const { failures } = evaluateAudit(report(rscCsrf), allowlist, new Date('2026-11-01'))

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('2026-10-31')
  })

  it('fails on an exemption that no longer matches anything', () => {
    // The dangerous state: upstream ships a fix, the entry stays, and the next
    // advisory in that package walks through the hole it left.
    const { failures } = evaluateAudit({ vulnerabilities: {} }, allowlist, before)

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('no longer reported')
  })
})

describe('the shipped allowlist', () => {
  // Empty since DIA-204, so this asserts nothing today by design: it is here to
  // catch the next entry someone adds in a hurry, not to prove a state.
  it('gives every entry a reason and a review date', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(80)
      expect(entry.reviewBy).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(entry.reviewBy).getTime())).toBe(false)
    }
  })
})

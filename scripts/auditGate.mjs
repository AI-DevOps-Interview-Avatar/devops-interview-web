/**
 * `npm audit` as a build gate, with a reviewed allowlist.
 *
 * Plain `npm audit --audit-level=high` cannot be a gate here: the one advisory
 * we carry has no fixed release to move to, so the command would fail every
 * build until upstream ships one, and the team would learn to pass `|| true`.
 * The allowlist below is the alternative — every entry names an advisory, why
 * it does not reach this app, and a date by which somebody has to look again.
 *
 * Three ways this fails, all deliberate:
 *   - a high or critical advisory nobody has written down;
 *   - an allowlist entry past its `reviewBy` date;
 *   - an allowlist entry that no longer matches anything, because a stale
 *     exemption is how a real finding gets waved through later.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Severities that stop a build. Moderate and low are reported by `npm audit` and read by humans. */
const BLOCKING = new Set(['high', 'critical'])

export const ALLOWLIST = [
  {
    advisory: 'GHSA-qwww-vcr4-c8h2',
    package: 'react-router',
    reviewBy: '2026-10-31',
    reason:
      'CSRF bypass in React Router RSC mode: an action runs before the 400 response. ' +
      'Reachable only through a React Server Components handler — this app is a static ' +
      'SPA on GitHub Pages with no server, no actions, no cookies and no session to forge. ' +
      'No fixed 7.x release exists: the advisory covers 7.12.0 - 8.2.0 and 7.18.2 is the ' +
      'newest published version. Downgrading to 7.11.0, which is what `npm audit fix --force` ' +
      'proposes, trades this one advisory for six older ones (open redirect, XSS, DoS). ' +
      'Revisit when a patched release lands, or if this app ever grows a server.',
  },
]

/**
 * Every high/critical advisory in an `npm audit --json` report, deduplicated.
 *
 * npm reports the same advisory once per affected package — `react-router` and
 * then `react-router-dom`, which merely depends on it — and describes the
 * dependent with plain strings in `via` rather than repeating the advisory. So
 * only the object entries carry an identity, and keying on that collapses the
 * chain back to the single finding a human would recognise.
 */
export function findAdvisories(report) {
  const found = new Map()

  for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === 'string') continue
      if (!BLOCKING.has(via.severity)) continue

      const id = advisoryId(via)
      if (!found.has(id)) {
        found.set(id, { id, package: via.name, title: via.title, severity: via.severity })
      }
    }
  }

  return [...found.values()]
}

/** GHSA identifier from the advisory URL, falling back to npm's numeric source id. */
function advisoryId(via) {
  const ghsa = /GHSA-[a-z0-9-]+/i.exec(via.url ?? '')
  return ghsa ? ghsa[0] : `npm-${via.source}`
}

/**
 * @returns {{ failures: string[], allowed: string[] }} — `failures` empty means the gate passes.
 */
export function evaluateAudit(report, allowlist = ALLOWLIST, today = new Date()) {
  const advisories = findAdvisories(report)
  const failures = []
  const allowed = []

  for (const advisory of advisories) {
    const exemption = allowlist.find((entry) => entry.advisory === advisory.id)
    if (!exemption) {
      failures.push(
        `${advisory.severity}: ${advisory.id} in ${advisory.package} — ${advisory.title}. ` +
          'Fix it, or add a reviewed entry to ALLOWLIST in scripts/auditGate.mjs.',
      )
      continue
    }

    if (new Date(exemption.reviewBy) < today) {
      failures.push(
        `${advisory.id} in ${advisory.package} was exempt until ${exemption.reviewBy}, which has passed. ` +
          'Check whether a fixed release exists; extend the date only with a fresh reason.',
      )
      continue
    }

    allowed.push(`${advisory.id} in ${advisory.package} — exempt until ${exemption.reviewBy}`)
  }

  for (const entry of allowlist) {
    if (!advisories.some((advisory) => advisory.id === entry.advisory)) {
      failures.push(
        `${entry.advisory} is allowlisted but no longer reported — remove the entry. ` +
          'An exemption nobody needs is one that silently covers the next finding.',
      )
    }
  }

  return { failures, allowed }
}

/** `npm audit --json` exits non-zero whenever it finds anything, so the output is read either way. */
export function runNpmAudit() {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8' }))
  } catch (error) {
    if (error.stdout) return JSON.parse(error.stdout)
    throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { failures, allowed } = evaluateAudit(runNpmAudit())

  for (const note of allowed) console.log(`known: ${note}`)
  for (const failure of failures) console.error(`FAIL:  ${failure}`)

  if (failures.length > 0) process.exit(1)
  console.log(`npm audit gate passed (${allowed.length} reviewed exemption(s), nothing else high or critical).`)
}

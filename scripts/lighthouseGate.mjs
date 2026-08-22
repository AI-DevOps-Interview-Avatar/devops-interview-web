/**
 * Lighthouse thresholds for the production build, checked as a build step.
 *
 * The bundle budget next door measures what we ship; this measures what the
 * browser makes of it. They catch different things: a build can sit well inside
 * its byte budget and still render an unlabelled button, a 3:1 contrast pair or
 * a page with no `<title>`.
 *
 * Not every category is gated the same way, on purpose:
 *
 *   accessibility, best-practices, seo — deterministic audits. The same build
 *   scores the same on a laptop and on a loaded CI runner, so these are held at
 *   the level the app actually reaches and a drop is a real regression.
 *
 *   performance — a timing measurement on shared hardware. GitHub's runners
 *   vary enough that a strict number here would fail builds that changed
 *   nothing, everyone would learn to re-run it, and the whole gate would stop
 *   meaning anything. It is held a little under what CI reaches, so it catches
 *   a render-blocking script or a 2 MB image sneaking in, not a 3-point drift.
 *   Byte-level regressions are bundle:budget's job, and it is strict.
 *
 * Raising a number is allowed. Doing it without a sentence saying what got
 * worse and why is what this file exists to prevent.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Scores are 0-1, matching the Lighthouse report.
 *
 * `performance` is a ratchet, not a target: it sits under what the build
 * already reaches, so the screens that draw Rive avatars cannot get slower
 * unnoticed while DIA-201 is open. Closing DIA-201 raises it to 0.95, which
 * that ticket's acceptance criteria say outright.
 *
 * Which makes the number it is set against the whole point, and the first
 * version of this file got that wrong (DIA-202). It shipped 0.40, measured on
 * a laptop that had just run a build and the e2e suite; CI reports 86 and 88 on
 * the same commit. A ratchet six points under a floor of 86 is a ratchet; one
 * forty-six points under it would have watched the avatar screens halve in
 * score and stayed green.
 *
 * Source of the 0.80 below: run #40, commit e844820 — / 86, /interview 88,
 * /pipeline 99. Re-measure on CI before moving it, never locally.
 */
export const THRESHOLDS = {
  performance: 0.8,
  accessibility: 1,
  'best-practices': 1,
  seo: 1,
}

/**
 * The same 86-vs-48 spread that made 0.40 wrong also makes 0.80 unusable on a
 * laptop: a developer machine scores 50-60 on the avatar screens, so enforcing
 * the CI floor locally would mean a gate that is red for everyone, always. That
 * is the failure mode this file already argues against out loud.
 *
 * So performance is enforced where the number means something — a runner — and
 * reported without a verdict everywhere else. The other three are deterministic
 * and hold identically in both places; an unlabelled button is an unlabelled
 * button on any hardware.
 *
 * GitHub Actions sets CI=true. If it ever stops, the gate does not fail open
 * silently: `main()` prints which profile it used above the table.
 */
export function thresholdsFor(env = process.env) {
  if (env.CI) return THRESHOLDS

  return Object.fromEntries(Object.entries(THRESHOLDS).filter(([category]) => category !== 'performance'))
}

/**
 * Routes worth a full Lighthouse pass. Deliberately short — every entry costs
 * ~15s of CI, and these three cover the distinct shapes the app renders:
 *
 *   /          the entry point, and the only one whose load time a first-time
 *              visitor actually experiences
 *   /interview four Rive avatars, the heaviest thing the app draws
 *   /pipeline  a plain content screen — the shape every other page shares
 *
 * The meet session is not here: it needs a live speech engine and a camera
 * permission, and Lighthouse driving it would measure the stub, not the app.
 * Its accessibility is covered by e2e/lifecycle.spec.ts instead.
 */
export const ROUTES = ['/', '/interview', '/pipeline']

const CATEGORIES = Object.keys(THRESHOLDS)

/**
 * @param {{url: string, scores: Record<string, number>}[]} runs
 * @returns {string[]} one message per breach; empty means the build passes.
 */
export function checkScores(runs, thresholds = THRESHOLDS) {
  const failures = []

  if (runs.length === 0) {
    // Not a quality problem — it means the run produced nothing and this gate
    // has been passing on an empty list.
    return ['no Lighthouse runs to check — the gate is not looking at a real build']
  }

  for (const run of runs) {
    for (const [category, threshold] of Object.entries(thresholds)) {
      const score = run.scores[category]

      if (typeof score !== 'number' || Number.isNaN(score)) {
        // A category that failed to run scores `null`, which would silently
        // compare as "below threshold" or slip through a loose check.
        failures.push(`${run.url}: ${category} did not produce a score — the audit errored rather than passed`)
        continue
      }

      if (score < threshold) {
        failures.push(`${run.url}: ${category} scored ${pct(score)}, under the ${pct(threshold)} threshold`)
      }
    }
  }

  return failures
}

const pct = (score) => `${Math.round(score * 100)}`

/** Waits for the preview server to answer, so Lighthouse never races the build. */
async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Server not up yet — the loop below is the retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`preview server did not answer ${url} within ${timeoutMs / 1000}s`)
}

async function main() {
  const { chromium } = await import('@playwright/test')
  const lighthouse = (await import('lighthouse')).default
  const desktopConfig = (await import('lighthouse/core/config/desktop-config.js')).default

  const port = 4174
  const debugPort = 9222
  const base = `http://localhost:${port}/devops-interview-web/`

  // Its own port, not Playwright's 4173: `npm run test:e2e` and this gate run
  // one after the other in CI, and a lingering preview from either would make
  // the second one measure the first one's build.
  const preview = spawn('npm', ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
  })

  // Playwright's Chromium rather than whatever `chrome-launcher` finds on the
  // machine: CI installs exactly this binary for the e2e suite, and a gate that
  // silently measures a different browser than the one we test in is worse than
  // no gate.
  let browser
  try {
    await waitForServer(base)
    browser = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`] })

    const runs = []
    for (const route of ROUTES) {
      const url = new URL(route.replace(/^\//, ''), base).href
      const result = await lighthouse(url, { port: debugPort, output: 'json', logLevel: 'error' }, desktopConfig)
      if (!result?.lhr) throw new Error(`Lighthouse returned no report for ${url}`)

      const scores = Object.fromEntries(
        CATEGORIES.map((category) => [category, result.lhr.categories[category]?.score]),
      )
      // Category scores say a route regressed; they don't say what to fix.
      // These three audits are where DIA-201 starts: a CI-measured baseline
      // for the routes that draw Rive avatars, taken before any optimization.
      const metrics = {
        tbt: result.lhr.audits['total-blocking-time']?.numericValue,
        lcp: result.lhr.audits['largest-contentful-paint']?.numericValue,
        speedIndex: result.lhr.audits['speed-index']?.numericValue,
      }
      runs.push({ url: route, scores, metrics })
    }

    return runs
  } finally {
    await browser?.close()
    preview.kill()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runs = await main()
  const thresholds = thresholdsFor()

  console.log(
    thresholds.performance
      ? 'CI profile — all four categories enforced.'
      : 'local profile — performance is measured but not enforced; only CI numbers are comparable (see docs/lighthouse.md).',
  )

  const header = ['route'.padEnd(12), ...CATEGORIES.map((c) => c.slice(0, 5).padStart(7))].join(' ')
  console.log(header)
  for (const run of runs) {
    const cells = CATEGORIES.map((c) => String(pct(run.scores[c] ?? NaN)).padStart(7))
    console.log([run.url.padEnd(12), ...cells].join(' '))
  }

  // ms, not the 0-1 scores above — DIA-201's first acceptance criterion is a
  // CI-measured reading of these three for `/` and `/interview`, so they're
  // printed every run rather than gathered by hand once and then forgotten.
  const msHeader = ['route'.padEnd(12), 'TBT'.padStart(7), 'LCP'.padStart(7), 'SI'.padStart(7)].join(' ')
  console.log(msHeader)
  for (const run of runs) {
    const cell = (v) => (typeof v === 'number' ? String(Math.round(v)) : 'n/a').padStart(7)
    console.log([run.url.padEnd(12), cell(run.metrics.tbt), cell(run.metrics.lcp), cell(run.metrics.speedIndex)].join(' '))
  }

  const failures = checkScores(runs, thresholds)
  for (const failure of failures) console.error(`FAIL:  ${failure}`)

  if (failures.length > 0) {
    console.error('Fix the regression, or raise the threshold in scripts/lighthouseGate.mjs and say why.')
    process.exit(1)
  }

  console.log(
    `lighthouse gate passed — ${runs.length} routes, ${Object.keys(thresholds).length} enforced categories each.`,
  )
}

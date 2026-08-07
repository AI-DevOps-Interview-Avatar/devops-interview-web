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
 *   meaning anything. It is held low deliberately: this number catches a
 *   render-blocking script or a 2 MB image sneaking in, not a 3-point drift.
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
 * `performance` is set below what a healthy build should reach, and that is not
 * an oversight. The first run of this gate measured 48 on the two screens that
 * draw Rive avatars — Total Blocking Time of 5.3s and 9.4s — against 99 on a
 * plain content screen. That is a real defect with a real ticket (DIA-201), not
 * something to paper over by loosening the number until it passes quietly.
 *
 * 0.40 is a ratchet, not a target: it locks in today's floor so the avatars
 * cannot get slower unnoticed while DIA-201 is open. Closing DIA-201 raises
 * this to 0.90 in the same PR, which its acceptance criteria say outright.
 */
export const THRESHOLDS = {
  performance: 0.4,
  accessibility: 1,
  'best-practices': 1,
  seo: 1,
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
      runs.push({ url: route, scores })
    }

    return runs
  } finally {
    await browser?.close()
    preview.kill()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runs = await main()

  const header = ['route'.padEnd(12), ...CATEGORIES.map((c) => c.slice(0, 5).padStart(7))].join(' ')
  console.log(header)
  for (const run of runs) {
    const cells = CATEGORIES.map((c) => String(pct(run.scores[c] ?? NaN)).padStart(7))
    console.log([run.url.padEnd(12), ...cells].join(' '))
  }

  const failures = checkScores(runs)
  for (const failure of failures) console.error(`FAIL:  ${failure}`)

  if (failures.length > 0) {
    console.error('Fix the regression, or raise the threshold in scripts/lighthouseGate.mjs and say why.')
    process.exit(1)
  }

  console.log(`lighthouse gate passed — ${runs.length} routes, ${CATEGORIES.length} categories each.`)
}

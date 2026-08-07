import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guards the wiring DIA-121 put in place, not the steps themselves.
 *
 * The bug this replaces was not a broken step — every step passed. It was that
 * they all ran on `push` to main, so a pull request merged with an empty Checks
 * tab. Nothing in the build could have caught that, because from the build's
 * point of view everything was green. It just happened after the merge.
 *
 * These are string checks rather than a parsed YAML tree: adding a parser
 * dependency to assert the presence of four lines is a worse trade than the
 * odd false pass. What matters is that removing the trigger, or quietly
 * copy-pasting the step list back into one caller, fails here.
 */
const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')

const GATE_STEPS = [
  'npm run audit:ci',
  'npm run lint',
  'npm test',
  'npm run build',
  'npm run bundle:budget',
  'npm run test:e2e',
  'npm run lighthouse:ci',
]

describe('workflow wiring', () => {
  it('runs the checks on a pull request', () => {
    expect(read('ci.yml')).toContain('pull_request')
  })

  it('holds every gate in the reusable workflow', () => {
    const checks = read('checks.yml')

    for (const step of GATE_STEPS) expect(checks).toContain(step)
    expect(checks).toContain('workflow_call')
  })

  it('has both triggers call that one workflow rather than list steps again', () => {
    // The point of the reusable workflow: a step added to it cannot be missing
    // from one of the two places it needs to run.
    for (const caller of ['ci.yml', 'deploy-pages.yml']) {
      const text = read(caller)

      expect(text).toContain('uses: ./.github/workflows/checks.yml')
      for (const step of GATE_STEPS) expect(text).not.toContain(step)
    }
  })

  it('packages the site only on the deploy path', () => {
    // A pull request builds dist/ to prove it builds; it has nowhere to publish
    // it, and uploading a Pages artifact per PR would be noise at best.
    // Matching the input being switched on, not the word: ci.yml mentions it in
    // a comment explaining why it does not pass it.
    expect(read('deploy-pages.yml')).toContain('upload-pages-artifact: true')
    expect(read('ci.yml')).not.toContain('upload-pages-artifact: true')
  })
})

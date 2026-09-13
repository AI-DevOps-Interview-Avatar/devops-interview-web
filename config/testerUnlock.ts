/**
 * The code that `/pro?unlock=` accepts, baked into the bundle at build time.
 *
 * Comes from the environment rather than from a file so it never sits in the
 * repository — `TESTER_UNLOCK_CODE` is a repository secret in CI and an ordinary
 * shell variable locally. That keeps it out of the diff, which is worth doing
 * even though the built bundle is public and anyone who reads it finds the code:
 * a value in git is there for every future reader of the history, and rotating
 * it would mean a commit rather than a rerun.
 *
 * **No code configured means no unlock at all.** A build made without the secret
 * — someone's laptop, a fork's CI — has a `/pro?unlock=` that does nothing for
 * any value. That is the right default: the alternative, some fallback constant,
 * would ship an unlock in every build that ever forgot the variable.
 *
 * Read at config time rather than imported, for the same reason as
 * `appVersion()`: `vite.config.ts` and `vitest.config.ts` resolve modules under
 * different settings and this has to work unchanged in both.
 */

/** Short enough to guess is the same as no code, so the build refuses it. */
const MIN_LENGTH = 12

export function testerUnlockCode(): string {
  const code = process.env.TESTER_UNLOCK_CODE?.trim() ?? ''
  if (!code) return ''

  // Failing the build beats shipping `?unlock=test` and believing it is a door
  // only testers know about.
  if (code.length < MIN_LENGTH) {
    throw new Error(`testerUnlockCode: TESTER_UNLOCK_CODE must be at least ${MIN_LENGTH} characters`)
  }

  return code
}

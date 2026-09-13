/**
 * Constants Vite substitutes at build time (`define` in vite.config.ts, and the
 * same value in vitest.config.ts so tests see a real version rather than a
 * ReferenceError).
 */

/** The release this bundle was built from — package.json's `version`. */
declare const __APP_VERSION__: string

/**
 * The code `/pro?unlock=` accepts, or `''` when this build was made without
 * `TESTER_UNLOCK_CODE` — in which case there is no unlock at all.
 */
declare const __TESTER_UNLOCK_CODE__: string

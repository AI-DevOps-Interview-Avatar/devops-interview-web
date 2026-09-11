/**
 * Constants Vite substitutes at build time (`define` in vite.config.ts, and the
 * same value in vitest.config.ts so tests see a real version rather than a
 * ReferenceError).
 */

/** The release this bundle was built from — package.json's `version`. */
declare const __APP_VERSION__: string

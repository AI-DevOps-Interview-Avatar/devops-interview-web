import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { appVersion } from './config/appVersion.ts'
import { testerUnlockCode } from './config/testerUnlock.ts'

export default defineConfig({
  plugins: [react()],
  // The same substitution the real build makes. Without it every module that
  // reads the version is a ReferenceError under vitest, which would push the
  // constant out of the tested part of the app.
  //
  // The unlock code is normally empty here, and the unit tests pass a code in
  // explicitly rather than relying on the environment: a suite that only passes
  // when a variable happens to be exported is a suite that fails on a colleague's
  // machine for reasons nobody can see.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __TESTER_UNLOCK_CODE__: JSON.stringify(testerUnlockCode()),
  },
  test: {
    environment: 'node',
    globals: false,
    // `e2e/` is Playwright's. Its specs import @playwright/test and drive a
    // real browser, and vitest's default glob would otherwise pick them up and
    // fail on the import alone.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})

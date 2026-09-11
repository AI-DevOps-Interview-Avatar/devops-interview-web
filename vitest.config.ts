import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { appVersion } from './config/appVersion.ts'

export default defineConfig({
  plugins: [react()],
  // The same substitution the real build makes. Without it every module that
  // reads the version is a ReferenceError under vitest, which would push the
  // constant out of the tested part of the app.
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  test: {
    environment: 'node',
    globals: false,
    // `e2e/` is Playwright's. Its specs import @playwright/test and drive a
    // real browser, and vitest's default glob would otherwise pick them up and
    // fail on the import alone.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})

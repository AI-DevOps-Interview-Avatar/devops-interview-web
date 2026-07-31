import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: false,
    // `e2e/` is Playwright's. Its specs import @playwright/test and drive a
    // real browser, and vitest's default glob would otherwise pick them up and
    // fail on the import alone.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})

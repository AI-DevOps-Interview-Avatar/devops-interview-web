import { defineConfig, devices } from '@playwright/test'

/**
 * Acceptance suite for DIA-166. Runs against the production build, not the dev
 * server: the CSP, the base path and the route-level chunks only exist there,
 * and every one of those has already broken the deployed site at least once.
 *
 * One browser by design. What actually differs between engines is the speech
 * engine, and these tests stub it — running the same stub in three browsers
 * would test our code three times and tell us nothing new about theirs. The
 * per-engine voice behaviour is covered where it can be asserted honestly:
 * `src/shared/voice/tts.test.ts` runs the resolver against real Chrome, Edge,
 * Safari and RHVoice voice lists, and `docs/voice-matrix.md` records the
 * expected outcome per cell. See docs/e2e.md.
 */
const PORT = 4173
const BASE_PATH = '/devops-interview-web/'

export default defineConfig({
  testDir: './e2e',
  // A stalled test here means a silent wait on speech that never happens, and
  // the default 30s makes that a slow discovery.
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // The self-camera tile calls getUserMedia; without this Chromium blocks on
    // a permission prompt no test can answer.
    permissions: ['microphone', 'camera'],
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Feeds getUserMedia a synthetic stream so the camera tile has
          // something to show and never waits on hardware.
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

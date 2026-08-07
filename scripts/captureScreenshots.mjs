/**
 * Regenerates `screenshots/` from a running build.
 *
 * The images in the README and the release notes drift the moment a layout
 * changes, and nothing fails when they do — the July set still showed the old
 * fixed-width pages three weeks after DIA-161 replaced them. This makes
 * refreshing them one command rather than an afternoon of window cropping.
 *
 *   BASE_URL=https://ai-devops-interview-avatar.github.io/devops-interview-web/ \
 *     node scripts/captureScreenshots.mjs
 *
 * Defaults to the deployed site, which is the honest source for release notes:
 * what it captures is what a visitor gets. Point BASE_URL at a local preview to
 * shoot something that has not shipped yet.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE_URL = process.env.BASE_URL ?? 'https://ai-devops-interview-avatar.github.io/devops-interview-web/'
const OUT = 'screenshots'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** Rive rigs decode asynchronously; a shot taken too early shows placeholder initials. */
async function settle(page, { avatars = 0 } = {}) {
  if (avatars > 0) {
    await page
      .waitForFunction((count) => document.querySelectorAll('[data-testid="avatar"] canvas').length >= count, avatars, {
        timeout: 30_000,
      })
      .catch(() => console.warn('  (avatars did not all draw — shooting anyway)'))
  }
  // Lets the hero gradient and the card hover transitions come to rest.
  await page.waitForTimeout(1200)
}

async function shoot(page, name, viewport) {
  await page.setViewportSize(viewport)
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 82, type: 'jpeg' })
  console.log(`  ${OUT}/${name}.jpg  ${viewport.width}×${viewport.height}`)
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const context = await browser.newContext({ viewport: DESKTOP, permissions: ['microphone', 'camera'] })
const page = await context.newPage()

// English, and a clean slate: a dismissed privacy note or a half-finished
// pipeline from a previous run would be baked into the images.
await page.addInitScript(() => {
  localStorage.setItem('devops-interview-web:lang', 'en')
})

const url = (path) => new URL(path, BASE_URL).href

console.log(`Capturing ${BASE_URL}`)

await page.goto(url('interview'))
await settle(page, { avatars: 4 })
await shoot(page, 'interviewer-selection', DESKTOP)
await shoot(page, 'interviewer-selection-mobile', PHONE)

await page.setViewportSize(DESKTOP)
await page.goto(url('pipeline'))
await settle(page, { avatars: 4 })
await shoot(page, 'hiring-pipeline', DESKTOP)

await page.goto(url('practice'))
await settle(page)
await shoot(page, 'practice', DESKTOP)

await page.goto(url('resume-review'))
await settle(page)
await shoot(page, 'resume-review', DESKTOP)

await page.goto(url('engine'))
// The bundle probe is a HEAD across the network; wait for it to report.
await page
  .waitForFunction(() => !document.querySelector('[data-testid="probe-bundle"]')?.textContent?.includes('…'), {
    timeout: 20_000,
  })
  .catch(() => {})
await page.getByTestId('engine-run').click()
await page.waitForSelector('[data-testid="engine-verdict"]', { timeout: 60_000 }).catch(() => {})
await settle(page)
await shoot(page, 'engine-check', DESKTOP)

// The session, with the transcript panel open so both halves of the screen show.
await page.goto(url('interview/senior-devops'))
await page.waitForSelector('[data-testid="caption"]', { timeout: 30_000 }).catch(() => {})
await settle(page, { avatars: 1 })
await shoot(page, 'meet-session', DESKTOP)

// Same session on a phone: the chat is an off-canvas drawer there, and the
// toolbar drops its decorative stubs (DIA-161).
await page.setViewportSize(PHONE)
await page.reload()
await page.waitForSelector('[data-testid="caption"]', { timeout: 30_000 }).catch(() => {})
await settle(page, { avatars: 1 })
await shoot(page, 'meet-session-mobile', PHONE)

await browser.close()
console.log('done')

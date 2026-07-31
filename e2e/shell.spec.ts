import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { seedLanguage, waitForQuestion } from './session'

/**
 * The checklist that used to be manual: avatars drawing, a clean console, and
 * nothing reaching off-origin.
 *
 * Two production incidents came from exactly this gap. `img-src` without
 * `blob:` left two of four rigs as empty circles, and the Rive runtime was
 * fetched from unpkg on a page holding camera permission. Both were invisible
 * to `npm run build` and to every unit test, and both were found by a person
 * opening the site — DIA-173 and DIA-181.
 */

const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net']

function watch(page: Page) {
  const violations: string[] = []
  const offOrigin: string[] = []

  page.on('console', (message: ConsoleMessage) => {
    const text = message.text()
    if (message.type() === 'error' || /Refused to|Content Security Policy/i.test(text)) {
      violations.push(text)
    }
  })
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`))
  page.on('request', (request: Request) => {
    const url = request.url()
    if (CDN_HOSTS.some((host) => url.includes(host))) offOrigin.push(url)
  })

  return { violations, offOrigin }
}

test.describe('the shell every screen sits in', () => {
  test('draws all four avatars with a clean console', async ({ page }) => {
    const watcher = watch(page)
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview')
    const avatars = page.getByTestId('avatar')
    await expect(avatars).toHaveCount(4)

    // A rig that fails to decode leaves the canvas out entirely and shows the
    // initial-letter placeholder instead — no error, just a blank circle.
    await expect.poll(() => avatars.locator('canvas').count(), { timeout: 15_000 }).toBe(4)

    expect(watcher.violations).toEqual([])
  })

  test('never reaches for a CDN, on any screen', async ({ page }) => {
    const watcher = watch(page)
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    for (const screen of ['', 'interview', 'practice', 'resources']) {
      await page.goto(screen)
      await expect(page.locator('body')).not.toBeEmpty()
    }

    await page.goto('interview/cto')
    await waitForQuestion(page)

    // The WASM runtime is served from our own origin now; the loader's built-in
    // unpkg default is still in the bundle, so a regression here is a real
    // request rather than a missing string.
    expect(watcher.offOrigin).toEqual([])
    expect(watcher.violations).toEqual([])
  })

  test('serves the Rive runtime from this origin', async ({ page }) => {
    const wasmRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('.wasm')) wasmRequests.push(request.url())
    })
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview')
    await expect.poll(() => wasmRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)

    for (const url of wasmRequests) {
      expect(new URL(url).host).toBe(new URL(page.url()).host)
    }
  })

  test('a deep link into a session works on a cold load', async ({ page }) => {
    // Route-level code splitting (DIA-134) means this screen's chunk is fetched
    // on demand; a deep link is the path with no warm-up in front of it.
    const watcher = watch(page)
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview/hr')
    await waitForQuestion(page)

    await expect(page.getByTestId('avatar')).toBeVisible()
    await expect(page.getByTestId('caption')).not.toBeEmpty()
    expect(watcher.violations).toEqual([])
  })
})

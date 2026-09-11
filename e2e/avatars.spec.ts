import { expect, test, type Page } from '@playwright/test'
import { seedLanguage } from './session'

/**
 * The frame an idle avatar is frozen on (DIA-219).
 *
 * DIA-201 stopped the decorative rigs from looping, which left each of them
 * holding its state machine's opening pose. Marcus's opening pose has his eyes
 * shut — the eyelids are down in the artboard and an animation opens them — so
 * the card that says "Senior DevOps" showed a sleeping man. Nothing failed: the
 * canvas drew, the count was four, the console was clean.
 *
 * Pixels are the only honest evidence here, so these tests read the canvas. Not
 * a screenshot comparison — the eye band's mean luminance is enough to tell
 * eyelids down from eyelids up, and it does not break when a colour changes.
 */

const MARCUS = '[data-testid="avatar"][data-interviewer-id="senior-devops"]'

/**
 * Mean luminance of the band the eyes sit in. Closed eyelids are the skin tone
 * of the lids; open eyes are dark pupils, which pull the mean down.
 */
async function eyeBand(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`${selector} canvas`)!
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const top = Math.round(canvas.height * 0.3)
    const height = Math.max(1, Math.round(canvas.height * 0.22))
    const { data } = context.getImageData(0, top, canvas.width, height)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return sum / (data.length / 4)
  }, MARCUS)
}

/** The rig is on screen and has painted something other than an empty canvas. */
async function waitForFirstPaint(page: Page): Promise<number> {
  await expect(page.locator(`${MARCUS} canvas`)).toBeVisible({ timeout: 15_000 })
  let band = 0
  await expect
    .poll(async () => (band = await eyeBand(page)), { timeout: 10_000, intervals: [30] })
    .toBeGreaterThan(0)
  return band
}

/**
 * The two extremes of the rig's own idle loop, sampled while it runs.
 *
 * Hardcoding "eyes open looks like 94.9" would pin the test to this renderer on
 * this machine. The loop blinks about once a second, so a couple of seconds of
 * it contains both a fully open frame and a fully shut one, and every question
 * worth asking about a frozen frame is a question about where it sits between
 * those two. Sampled inside the page: forty round trips would cost more time
 * than the blink lasts.
 */
async function idleRange(page: Page): Promise<{ open: number; shut: number }> {
  const samples = await page.evaluate(async (selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`${selector} canvas`)!
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const top = Math.round(canvas.height * 0.3)
    const height = Math.max(1, Math.round(canvas.height * 0.22))

    const band = () => {
      const { data } = context.getImageData(0, top, canvas.width, height)
      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      return sum / (data.length / 4)
    }

    const taken: number[] = []
    for (let i = 0; i < 80; i++) {
      await new Promise((resolve) => setTimeout(resolve, 35))
      taken.push(band())
    }
    return taken
  }, MARCUS)

  // Closed eyelids are lit skin; open eyes are dark pupils in the same band.
  return { open: Math.min(...samples), shut: Math.max(...samples) }
}

test.describe('the idle avatar on the selection screen', () => {
  test.beforeEach(async ({ page }) => {
    await seedLanguage(page, 'en')
  })

  test('freezes Marcus with his eyes open', async ({ page }) => {
    await page.goto('interview')
    await waitForFirstPaint(page)

    // Well past parkAtMs and past the first blink, so a rig that never stopped
    // would not be sitting still by now either.
    await page.waitForTimeout(2_000)
    const parked = await eyeBand(page)

    // Run the rig and watch it blink, which gives both ends of the scale
    // without a single hardcoded luminance.
    await page.locator(MARCUS).hover()
    const { open, shut } = await idleRange(page)
    await page.mouse.move(5, 5)

    // If the window caught no blink there is nothing to compare against, and a
    // pass would mean nothing.
    expect(shut - open, `no blink in the sampled window (${open.toFixed(2)}–${shut.toFixed(2)})`).toBeGreaterThan(1)

    const closedness = (parked - open) / (shut - open)
    expect(
      closedness,
      `parked ${parked.toFixed(2)} against open ${open.toFixed(2)} / shut ${shut.toFixed(2)}`,
    ).toBeLessThan(0.35)
  })

  test('freezes on the same frame whether or not the tile was hovered', async ({ page }) => {
    // The blink loop runs about once a second, so pausing the instant a pointer
    // leaves would freeze a blink roughly one time in five. The hover below
    // lasts a deliberately unhelpful 1.4s — past the first blink and nowhere
    // near a whole number of cycles.
    await page.goto('interview')
    await waitForFirstPaint(page)
    await page.waitForTimeout(2_000)
    const beforeHover = await eyeBand(page)

    await page.locator(MARCUS).hover()
    await page.waitForTimeout(1_400)
    await page.mouse.move(5, 5)

    // Long enough for the rig to run out the rest of its loop and stop.
    await page.waitForTimeout(2_000)
    const afterHover = await eyeBand(page)

    expect(
      Math.abs(afterHover - beforeHover),
      `before ${beforeHover.toFixed(2)} vs after ${afterHover.toFixed(2)}`,
    ).toBeLessThan(0.3)
  })

  test('still parks the other three rigs on the frame they load with', async ({ page }) => {
    // The warm-up is not free, and it is not needed by rigs whose opening pose
    // is already a face. If one of them starts animating on load, this is where
    // the extra main-thread work shows up.
    await page.goto('interview')
    await expect(page.locator('[data-testid="avatar"] canvas')).toHaveCount(4, { timeout: 15_000 })
    await page.waitForTimeout(1_200)

    for (const id of ['recruiter', 'cto', 'hr']) {
      const selector = `[data-testid="avatar"][data-interviewer-id="${id}"] canvas`
      const sample = () =>
        page.evaluate((sel) => {
          const canvas = document.querySelector<HTMLCanvasElement>(sel)!
          const context = canvas.getContext('2d', { willReadFrequently: true })!
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
          let sum = 0
          for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2]
          return sum / (data.length / 4)
        }, selector)

      const first = await sample()
      await page.waitForTimeout(700)
      expect(await sample(), `${id} is still moving`).toBeCloseTo(first, 1)
    }
  })
})

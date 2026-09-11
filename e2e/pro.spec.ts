import { expect, test } from '@playwright/test'
import { seedLanguage, seedPro } from './session'

/**
 * The paywall (DIA-218), and the home screen's footer that landed with it.
 *
 * What is worth asserting here is not the prices — those are a unit test's job
 * in `src/domain/pro.test.ts` — but the three things that make a gate a gate
 * rather than a decoration: the pills say which screens are paid, the URLs are
 * closed and not just the links, and a visitor who has a plan gets the screen
 * and not the price list.
 *
 * And one thing that makes it honest: the pricing screen states, next to the
 * numbers, that no payment can be taken yet.
 */

test.describe('the Pro gate', () => {
  test.beforeEach(async ({ page }) => {
    await seedLanguage(page, 'en')
  })

  test('marks the two paid pills and sends them to the plans', async ({ page }) => {
    await page.goto('interview')

    const locked = page.getByTestId('nav-pill-locked')
    await expect(locked).toHaveCount(2)
    await expect(locked.first()).toContainText('PRO')

    // The free pills keep their number: gating is not allowed to quietly spread.
    await expect(page.getByTestId('nav-pill')).toHaveCount(3)

    await locked.first().click()
    await expect(page).toHaveURL(/\/pro\?feature=practice$/)
    // Arrived from a gate, so the page names the screen that was asked for
    // rather than dropping the visitor on a generic price list.
    await expect(page.getByTestId('pro-requested')).toContainText('Practice')
  })

  test('closes the URL, not just the link', async ({ page }) => {
    // The way a paid screen is actually reached without passing a pill: a
    // bookmark, a link from the README, an address typed from memory.
    await page.goto('resume-review')

    await expect(page).toHaveURL(/\/pro\?feature=resumeReview$/)
    await expect(page.getByTestId('pro-plans')).toBeVisible()
  })

  test('leaves Back pointing at where the visitor came from', async ({ page }) => {
    await page.goto('interview')
    await page.goto('practice')
    await expect(page).toHaveURL(/\/pro\?feature=practice$/)

    // The redirect replaces the locked entry instead of stacking on it. Without
    // that, Back lands on /practice, which redirects again — a trap rather than
    // a gate.
    await page.goBack()
    await expect(page).toHaveURL(/\/interview$/)
  })

  test('states that payments are not live, right next to the prices', async ({ page }) => {
    await page.goto('pro')

    await expect(page.getByTestId('pro-plan')).toHaveCount(3)
    await expect(page.getByTestId('pro-plan').filter({ hasText: 'Best value' })).toHaveCount(1)

    const notice = page.getByTestId('pro-not-live')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(/not live/i)

    await expect(page.getByTestId('pro-notify')).toHaveAttribute('href', /^https:\/\/t\.me\//)

    // Opened directly rather than by redirect: there is no screen to name.
    await expect(page.getByTestId('pro-requested')).toHaveCount(0)
  })

  test('opens the paid screens for a visitor who has a plan', async ({ page }) => {
    await seedPro(page)

    await page.goto('practice')
    await expect(page).toHaveURL(/\/practice$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('resume-review')
    await expect(page).toHaveURL(/\/resume-review$/)

    // And the locks come off the pills, rather than the screens opening behind
    // a nav row that still says they are shut.
    await page.goto('interview')
    await expect(page.getByTestId('nav-pill-locked')).toHaveCount(0)
    await expect(page.getByTestId('nav-pill')).toHaveCount(5)
  })
})

test.describe('the home screen chrome', () => {
  test.beforeEach(async ({ page }) => {
    await seedLanguage(page, 'en')
    await page.goto('interview')
    await expect(page.getByTestId('interviewer-card').first()).toBeVisible()
  })

  test('puts Developers bottom-left and the build version bottom-right', async ({ page }) => {
    const developers = page.getByTestId('footer-developers')
    const version = page.getByTestId('app-version')

    await expect(developers).toBeVisible()
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+/)

    const [left, right] = await Promise.all([developers.boundingBox(), version.boundingBox()])
    expect(left!.x).toBeLessThan(right!.x)

    // Below everything else on the page, which is what makes it a footer.
    const lastCard = (await page.getByTestId('interviewer-card').last().boundingBox())!
    expect(left!.y).toBeGreaterThan(lastCard.y + lastCard.height)

    await developers.click()
    await expect(page).toHaveURL(/\/developers$/)
  })

  test('offers the engine check as advice rather than as a sixth feature', async ({ page }) => {
    // Headless Chromium has no WebGPU adapter, so the note is in its check
    // state — the one every visitor without a GPU sees.
    const note = page.getByTestId('engine-check-note')
    await expect(note).toBeVisible()

    // It sits in the advice block under the privacy note, not in the pill row.
    const pills = (await page.locator('.page__header').boundingBox())!
    const box = (await note.boundingBox())!
    expect(box.y).toBeGreaterThan(pills.y + pills.height)

    await page.getByTestId('engine-check-link').click()
    await expect(page).toHaveURL(/\/engine$/)
  })
})

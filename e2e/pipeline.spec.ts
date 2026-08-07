import { expect, test } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { answerUntilFinished, seedLanguage, seedPipelineProgress, waitForQuestion } from './session'

/** The five-stage hiring flow: gating, progression, and the offer at the end. */

test.describe('pipeline gating', () => {
  test('a locked stage cannot be reached by URL', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    // Straight to Stage 3 with nothing completed. The guard bounces it back to
    // the overview rather than starting an interview out of order.
    await page.goto('pipeline/stage/2')
    await expect(page).toHaveURL(/\/pipeline$/)
    await expect(page.getByTestId('stage-card').first()).toBeVisible()
  })

  test('completed stages unlock exactly the next one', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0, 1])

    await page.goto('pipeline')
    const cards = page.getByTestId('stage-card')
    await expect(cards.nth(0)).toHaveAttribute('data-stage-status', 'completed')
    await expect(cards.nth(1)).toHaveAttribute('data-stage-status', 'completed')
    await expect(cards.nth(2)).not.toHaveAttribute('data-stage-status', 'locked')
    await expect(cards.nth(3)).toHaveAttribute('data-stage-status', 'locked')
  })

  test('the offer page is reachable once every stage is done', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0, 1, 2, 3])

    await page.goto('pipeline')
    await page.getByTestId('stage-card').nth(4).click()
    await expect(page).toHaveURL(/\/pipeline\/offer$/)
    await expect(page.locator('body')).toContainText(/offer/i)
  })
})

// DIA-135: the name is asked by Emma at Stage 1 like every other detail, so by
// the time the offer exists there is nothing left to fill in by hand.
test.describe('the offer letter is addressed from Stage 1', () => {
  test('greets the candidate by the name screening captured', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0, 1, 2, 3], { candidateName: 'Jane Doe', salaryExpectations: '$4500' })

    await page.goto('pipeline/offer')
    await expect(page.locator('pre')).toContainText('Dear Jane Doe')
    await expect(page.locator('pre')).toContainText('$4500')
  })

  test('no longer asks for a name it already has', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0, 1, 2, 3], { candidateName: 'Jane Doe' })

    await page.goto('pipeline/offer')
    await expect(page.locator('pre')).toContainText('Dear Jane Doe')
    await expect(page.locator('input')).toHaveCount(0)
  })

  test('falls back to a placeholder rather than "Dear undefined" for a pre-DIA-135 profile', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0, 1, 2, 3], { salaryExpectations: '$4500' })

    await page.goto('pipeline/offer')
    await expect(page.locator('pre')).toContainText('Dear —')
    await expect(page.locator('pre')).not.toContainText('undefined')
  })
})

// DIA-203: the letter now ends with the one instruction a candidate is meant to
// act on, so it has to survive interpolation and a language switch intact.
test.describe('the offer letter signs off with a real contact', () => {
  const LINKEDIN = 'https://www.linkedin.com/in/d-nishimatsu/'

  for (const lang of ['en', 'ua'] as const) {
    test(`shows the contact and the company in ${lang}`, async ({ page }) => {
      await installSpeechStub(page, { voices: 'chrome' })
      await seedLanguage(page, lang)
      await seedPipelineProgress(page, [0, 1, 2, 3], { candidateName: 'Jane Doe' })

      await page.goto('pipeline/offer')

      const letter = page.locator('pre')
      await expect(letter).toContainText('Danylo Nishimatsu')
      await expect(letter).toContainText(LINKEDIN)
      await expect(letter).toContainText('Brewly Store')
      // An unresolved placeholder renders literally, and reads as a bug to the
      // one person the letter is asking the candidate to write to.
      await expect(letter).not.toContainText('{{')
    })
  }
})

test.describe('a stage from start to summary', () => {
  // Every question of a stage, answered one by one — minutes of streamed
  // tokens, not seconds.
  test.slow()

  test('stage 2 completes and unlocks stage 3', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0])

    await page.goto('pipeline/stage/1')
    await waitForQuestion(page)
    const answered = await answerUntilFinished(page)
    expect(answered).toBeGreaterThan(0)

    await expect(page.getByTestId('assessment')).toBeVisible()
    await page.getByTestId('pipeline-continue').click()

    // The stage that was locked a moment ago is now the one the candidate is in.
    await expect(page).toHaveURL(/\/pipeline\/stage\/2$/)
    await waitForQuestion(page)
  })

  test('progress survives a reload mid-pipeline', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await seedPipelineProgress(page, [0])

    await page.goto('pipeline/stage/1')
    await waitForQuestion(page)
    await answerUntilFinished(page)
    await expect(page.getByTestId('assessment')).toBeVisible()

    await page.reload()
    await page.goto('pipeline')
    await expect(page.getByTestId('stage-card').nth(1)).toHaveAttribute('data-stage-status', 'completed')
  })
})

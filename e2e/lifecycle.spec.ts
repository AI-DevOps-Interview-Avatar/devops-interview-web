import { expect, test } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { answer, answerUntilFinished, seedLanguage, userMessages, waitForQuestion } from './session'

/**
 * Audio lifecycle: the class of defect where the app keeps talking after the
 * screen it belongs to is gone, or stops being able to talk at all.
 *
 * None of these are visible in a unit test — they are about what survives a
 * navigation.
 */

test.describe('speech lifecycle', () => {
  test('finishing an interview leaves nothing playing', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome', utteranceMs: 5_000 })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    await answerUntilFinished(page)

    await expect(page.getByTestId('assessment')).toBeVisible()
    // The recruiter used to talk over the Session Summary: the last question is
    // still mid-utterance when the final answer lands.
    expect(await speech.speaking()).toBe(false)
  })

  test('hanging up cuts the current utterance', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome', utteranceMs: 5_000 })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    expect(await speech.speaking()).toBe(true)

    await page.getByTestId('hangup').click()
    await expect(page.getByTestId('interviewer-card').first()).toBeVisible()

    expect(await speech.speaking()).toBe(false)
    expect((await speech.spoken()).some((utterance) => utterance.cancelled)).toBe(true)
  })

  test('leaving through the nav bar is as quiet as hanging up', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome', utteranceMs: 5_000 })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    await page.getByRole('link', { name: /home/i }).or(page.getByRole('button', { name: /home/i })).first().click()
    await expect(page.getByTestId('chat-input')).toBeHidden()
    expect(await speech.speaking()).toBe(false)
  })
})

test.describe('microphone', () => {
  test('a spoken answer is posted as the candidate turn', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    const before = await userMessages(page).count()

    await page.getByTestId('mic').click()
    await expect(page.getByTestId('recording-status')).toContainText(/listening/i)

    await page.evaluate(() => window.__speech.say('I ran the platform team for three years'))
    await page.getByTestId('mic').click()

    await expect(userMessages(page)).toHaveCount(before + 1)
    await expect(userMessages(page).last()).toContainText('platform team')
  })

  test('each failure says what to do about it, rather than "no speech detected"', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    await page.getByTestId('mic').click()
    await expect(page.getByTestId('recording-status')).toBeVisible()
    await page.evaluate(() => window.__speech.failWith('not-allowed'))

    const banner = page.getByTestId('mic-error')
    await expect(banner).toBeVisible()
    // The recovery step is the whole point of the ticket: a permission problem
    // has to read differently from silence.
    await expect(banner).toContainText(/microphone|permission|settings/i)
  })

  test('twenty presses never leave the button stuck', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    const mic = page.getByTestId('mic')
    for (let press = 0; press < 20; press++) {
      await mic.click()
    }
    // Twenty presses is an even number, so the recognizer must be closed —
    // sessions used to pile up until the mic stopped responding entirely.
    await expect(page.getByTestId('recording-status')).not.toContainText(/listening/i)
    await mic.click()
    await expect(page.getByTestId('recording-status')).toContainText(/listening/i)
  })

  test('the button is disabled, not silently inert, without recognition support', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome', withoutRecognition: true })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    await expect(page.getByTestId('mic')).toBeDisabled()
    // Text input has to remain the way through — this is Firefox and Safari.
    await answer(page, 'Typed, because this browser has no speech recognition.')
    await expect(userMessages(page).last()).toContainText('no speech recognition')
  })
})

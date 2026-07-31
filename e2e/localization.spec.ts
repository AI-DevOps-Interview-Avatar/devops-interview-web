import { expect, test } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { CYRILLIC, interviewerTurns, seedLanguage, waitForQuestion } from './session'

/**
 * Localization, including the case the QA report kept hitting: switching
 * language in the middle of a stage.
 *
 * The transcript re-renders instantly because messages hold a question index
 * rather than text — which is exactly why audio still playing in the old
 * language then contradicts what is on screen.
 */

test.describe('mid-interview language switch', () => {
  test('stops the old language and re-speaks in the new one', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome', utteranceMs: 5_000 })
    await seedLanguage(page, 'ua')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    const ukrainian = await speech.spoken()
    expect(ukrainian.every((utterance) => utterance.lang === 'uk-UA')).toBe(true)

    const marker = await speech.mark()
    await page.getByTestId('lang-en').click()

    await expect.poll(() => speech.speaking(), { timeout: 5_000 }).toBe(true)
    const afterSwitch = await speech.since(marker)
    expect(afterSwitch.length).toBeGreaterThan(0)
    expect(afterSwitch.every((utterance) => utterance.lang === 'en-US')).toBe(true)

    // Everything queued in Ukrainian was cut, not left to finish under English
    // text. Re-read rather than reuse the snapshot above: `cancelled` is set on
    // the page's copy after that snapshot was taken.
    const ukrainianAfter = (await speech.spoken()).slice(0, marker)
    expect(ukrainianAfter.some((utterance) => utterance.cancelled)).toBe(true)
  })

  test('re-renders the whole transcript, not just what comes next', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    const inUkrainian = await interviewerTurns(page)
    expect(inUkrainian.every((turn) => CYRILLIC.test(turn))).toBe(true)

    await page.getByTestId('lang-en').click()
    await expect
      .poll(async () => (await interviewerTurns(page)).every((turn) => !CYRILLIC.test(turn)))
      .toBe(true)

    // Same number of turns: switching language must not drop or duplicate one.
    expect(await interviewerTurns(page)).toHaveLength(inUkrainian.length)
  })

  test('keeps the persona on its own gender across the switch', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/senior-devops')
    await waitForQuestion(page)
    expect((await speech.spoken())[0].voice).toBe('Microsoft Ostap - Ukrainian (Ukraine)')

    const marker = await speech.mark()
    await page.getByTestId('lang-en').click()
    await expect.poll(async () => (await speech.since(marker)).length).toBeGreaterThan(0)

    const english = await speech.since(marker)
    expect(english[0].voice).toBe('Microsoft David - English (United States)')
  })
})

test.describe('no English fallback in Ukrainian', () => {
  const screens = ['', 'interview', 'pipeline', 'practice', 'resources', 'history', 'developers']

  for (const screen of screens) {
    test(`${screen || 'splash'} is fully translated`, async ({ page }) => {
      await installSpeechStub(page, { voices: 'chrome' })
      await seedLanguage(page, 'ua')

      await page.goto(screen)
      const body = page.locator('body')
      await expect(body).toContainText(CYRILLIC)

      // A missing key renders as the key itself — "meet.controls.hangup" on
      // screen, which reads as a bug to a candidate and is invisible to a
      // developer who only ever opens the English build.
      const text = await body.innerText()
      const rawKeys = text.match(/\b[a-z]+\.[a-z][a-zA-Z]+(\.[a-zA-Z]+)+\b/g) ?? []
      expect(rawKeys.filter((key) => !key.includes('.com') && !key.includes('.io'))).toEqual([])
    })
  }

  test('the session screen speaks Ukrainian in both senses', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/hr')
    await waitForQuestion(page)

    await expect(page.getByTestId('caption')).toContainText(CYRILLIC)
    expect((await speech.spoken()).every((utterance) => utterance.lang === 'uk-UA')).toBe(true)
  })
})

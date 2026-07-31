import { expect, test, type Page } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { seedLanguage, waitForQuestion } from './session'

/**
 * Persona voice binding, end to end.
 *
 * The resolver has unit tests against the same voice lists; what those cannot
 * see is whether the running app hands it the right persona, the right language
 * and the right moment. Every defect in this file's history was in that wiring,
 * not in the resolver: Emma starting with a male voice, English sessions
 * playing nothing at all, the whole cast collapsing onto one voice.
 */

test.describe('persona voices', () => {
  test('each persona speaks in a voice of its own gender', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    const emma = await speech.spoken()
    expect(emma.length).toBeGreaterThan(0)
    expect(emma.every((utterance) => utterance.voice === 'Microsoft Zira - English (United States)')).toBe(true)
    // A gendered voice was found, so prosody must be left alone: the pitch
    // shift is what made the network-backed voices sound choppy.
    expect(emma.every((utterance) => utterance.pitch === 1 && utterance.rate === 1)).toBe(true)

    await page.goto('interview/senior-devops')
    const marker = await speech.mark()
    await waitForQuestion(page)
    const marcus = await speech.since(marker)
    expect(marcus.length).toBeGreaterThan(0)
    expect(marcus.every((utterance) => utterance.voice === 'Microsoft David - English (United States)')).toBe(true)
  })

  test('the same persona keeps its voice across ten sessions', async ({ page }) => {
    test.slow()
    const speech = await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    const voicesUsed = new Set<string | null>()
    await page.goto('interview')
    for (let run = 0; run < 10; run++) {
      const marker = await speech.mark()
      await openRecruiterAndReturn(page, async () => {
        for (const utterance of await speech.since(marker)) voicesUsed.add(utterance.voice)
      })
    }

    // The original defect was randomness: the voice — and its gender — changed
    // between runs because the list was read before the browser had filled it.
    expect([...voicesUsed]).toEqual(['Microsoft Zira - English (United States)'])
  })

  test('speech still works on the tenth reopening, not just the first', async ({ page }) => {
    // Chrome used to wedge its queue after cancel() landed mid-utterance, and
    // every later speak() silently did nothing until a full page reload. Which
    // is why this reopens through the app rather than by navigating: a reload
    // is precisely the thing that used to hide the bug. The count matters too —
    // it passed at two reopenings and failed at six.
    test.slow()
    const speech = await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')

    await page.goto('interview')
    for (let run = 0; run < 10; run++) {
      const marker = await speech.mark()
      await openRecruiterAndReturn(page, async () => {
        expect(await speech.since(marker), `nothing was spoken on reopening #${run + 1}`).not.toHaveLength(0)
      })
    }
  })

  test('shares one voice by pitch when the locale only ships one', async ({ page }) => {
    // Safari's Ukrainian is a single voice, Lesya. Both personas land on it, and
    // prosody is then the only thing keeping Marcus from sounding like Emma.
    const speech = await installSpeechStub(page, { voices: 'safari' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    const female = await speech.spoken()

    const marker = await speech.mark()
    await page.goto('interview/senior-devops')
    await waitForQuestion(page)
    const male = await speech.since(marker)

    expect(female[0].voice).toBe('Lesya')
    expect(male[0].voice).toBe('Lesya')
    expect(male[0].pitch).toBeLessThan(female[0].pitch)
  })

  test('warns instead of going quietly silent when the locale has no voice', async ({ page }) => {
    const speech = await installSpeechStub(page, { voices: 'noUkrainian' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/recruiter')
    await expect(page.getByTestId('voice-unavailable')).toBeVisible()

    // Chrome speaks such an utterance anyway, in whatever default it has, so
    // every persona would otherwise sound identical. Pitch is what separates
    // them when no voice can be assigned.
    await waitForQuestion(page)
    const emma = await speech.spoken()
    expect(emma[0].voice).toBeNull()

    const marker = await speech.mark()
    await page.goto('interview/senior-devops')
    await waitForQuestion(page)
    const marcus = await speech.since(marker)
    expect(marcus[0].pitch).not.toBe(emma[0].pitch)
  })

  test('does not raise the warning when the engine reports no voices at all', async ({ page }) => {
    // Absence of information, not absence of coverage — a false alarm here is
    // worse than silence, because the engine may well speak with its default.
    await installSpeechStub(page, { voices: 'empty' })
    await seedLanguage(page, 'ua')

    await page.goto('interview/recruiter')
    await waitForQuestion(page)
    await expect(page.getByTestId('voice-unavailable')).toBeHidden()
  })
})

/**
 * Opens the recruiter from the selection screen and hangs up again, without
 * ever reloading the page — the way a candidate does it, and the only way the
 * "audio is dead until a hard refresh" defect can show itself.
 */
async function openRecruiterAndReturn(page: Page, assert: () => Promise<void>): Promise<void> {
  await page.locator('[data-testid="interviewer-card"][data-interviewer-id="recruiter"]').click()
  await waitForQuestion(page)
  await assert()
  await page.getByTestId('hangup').click()
  await expect(page.getByTestId('interviewer-card').first()).toBeVisible()
}

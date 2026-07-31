import { expect, type Page } from '@playwright/test'

/** Shared moves for driving an interview, so the specs read as scenarios rather than selectors. */

/** Seeds pipeline progress so a test can start at the stage it is about, instead of walking there. */
export async function seedPipelineProgress(page: Page, completedStages: number[]): Promise<void> {
  await page.addInitScript((stages: number[]) => {
    // Init scripts run on every navigation, so writing unconditionally would
    // undo the progress the app itself saved a moment earlier — and a test for
    // "progress survives a reload" would be testing the seed instead.
    if (localStorage.getItem('devops-interview-web:pipeline')) return
    localStorage.setItem(
      'devops-interview-web:pipeline',
      JSON.stringify({ completedStages: stages, candidateProfile: {}, savedAt: new Date().toISOString() }),
    )
  }, completedStages)
}

/** Forces the interface language before the app boots, the way a returning visitor's stored choice would. */
export async function seedLanguage(page: Page, lang: 'en' | 'ua'): Promise<void> {
  await page.addInitScript((value: string) => {
    localStorage.setItem('devops-interview-web:lang', value)
  }, lang)
}

export const interviewerMessages = (page: Page) => page.locator('[data-testid="message"][data-author="interviewer"]')
export const userMessages = (page: Page) => page.locator('[data-testid="message"][data-author="user"]')

/** Waits for the persona to finish its greeting and put the first question on screen. */
export async function waitForQuestion(page: Page): Promise<void> {
  // The input is disabled while a question streams in, so its enabled state is
  // the app's own signal that it is the candidate's turn.
  await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 20_000 })
  // Greeting plus first question: the greeting alone would pass a session that
  // never got as far as asking anything.
  await expect.poll(() => interviewerMessages(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
}

/** Types an answer and waits until the interview is ready for the next one (or has ended). */
export async function answer(page: Page, text = 'A reasonable answer about pipelines and monitoring.'): Promise<void> {
  const input = page.getByTestId('chat-input')
  await input.fill(text)
  await page.getByTestId('send').click()

  // Either the next question arrives (input enabled again) or the session ends
  // and the summary replaces the whole tile.
  await expect
    .poll(
      async () => {
        if (await page.getByTestId('assessment').isVisible()) return 'finished'
        return (await input.isEnabled().catch(() => false)) ? 'ready' : 'busy'
      },
      { timeout: 20_000 },
    )
    .not.toBe('busy')
}

/**
 * Answers every remaining question until the session summary appears.
 *
 * `limit` is a guard rather than a length: a stage that never finishes is a
 * defect, and a test that loops forever hides it behind a timeout.
 */
export async function answerUntilFinished(page: Page, limit = 60): Promise<number> {
  let answered = 0
  while (answered < limit) {
    if (await page.getByTestId('assessment').isVisible()) return answered
    await answer(page)
    answered += 1
  }
  throw new Error(`session did not finish after ${limit} answers`)
}

/** The text of every interviewer turn currently in the transcript. */
export async function interviewerTurns(page: Page): Promise<string[]> {
  return interviewerMessages(page).allInnerTexts()
}

export const CYRILLIC = /[Ѐ-ӿ]/

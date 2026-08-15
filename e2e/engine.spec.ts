import { expect, test } from '@playwright/test'
import { interviewerMessages, seedLanguage, waitForQuestion } from './session'

/**
 * The on-device engine, asserted where CI can actually assert it.
 *
 * What cannot be tested here is the model answering: MediaPipe's web runtime
 * needs a WebGPU adapter, the runner has none, and the weights are 528 MB that
 * no CI job should be pulling. That path was verified by hand instead — see
 * `docs/on-device-llm.md`, which records the machine, the flags and the output.
 *
 * What *is* tested here is the half that matters on most devices anyway: a
 * browser that cannot run the model says so, in words, and the interview still
 * works. That is the state every visitor is in until DIA-97 ships a bundle, and
 * it is the state the headless runner is permanently in — which makes it the
 * one case CI is genuinely good at.
 */

test.describe('the engine check screen', () => {
  test.beforeEach(async ({ page }) => {
    await seedLanguage(page, 'en')
  })

  test('reports each requirement separately, rather than one blank failure', async ({ page }) => {
    await page.goto('engine')

    // SIMD is the one requirement a headless runner does meet, so a green line
    // here also proves the probes are being evaluated rather than defaulted.
    await expect(page.getByTestId('probe-simd')).toContainText('✅')

    // No adapter in headless Chromium — the reason has to name that, not just
    // fail. `no-webgpu` and `no-gpu-adapter` are different problems for a user:
    // one means "wrong browser", the other "this machine".
    await expect(page.getByTestId('probe-webgpu')).toContainText(/no GPU adapter|no WebGPU/)

    // Nothing in `public/models/` in a CI build, by design.
    await expect(page.getByTestId('probe-bundle')).toContainText('❌', { timeout: 10_000 })
  })

  test('falls back to the scripted interview and says why', async ({ page }) => {
    await page.goto('engine')
    await page.getByTestId('engine-run').click()

    const verdict = page.getByTestId('engine-verdict')
    await expect(verdict).toBeVisible({ timeout: 30_000 })
    await expect(verdict).toHaveAttribute('data-kind', 'mock')

    // The fallback is allowed to be silent to the engine and must never be
    // silent to the person: an interview that quietly stops being on-device is
    // the one outcome this screen exists to prevent.
    await expect(page.getByTestId('engine-answer')).not.toBeEmpty()
  })

  test('explains how the weights get here, and links the release they come from', async ({ page }) => {
    // The shape of this section is forced by something outside the app: GitHub
    // sends no Access-Control-Allow-Origin on release assets, so the page cannot
    // fetch them however much it would like to. What must never regress is the
    // explanation — a bare file picker with no reason attached is indistinguishable
    // from a broken download button.
    await page.goto('engine')

    await expect(page.getByTestId('bundle-absent')).toContainText('CORS')
    await expect(page.getByTestId('bundle-release-link')).toHaveAttribute(
      'href',
      /devops-interview-app\/releases\/download\/v1\.5\.0\//,
    )
  })

  test('rejects a file that is not the bundle, and keeps nothing', async ({ page }) => {
    await page.goto('engine')

    await page.getByTestId('bundle-file-input').setInputFiles({
      name: 'Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('the right name and none of the bytes'),
    })

    await expect(page.getByTestId('bundle-error')).toBeVisible()
    // Still nothing on the device — the failed import must not leave a file the
    // engine would later try to load.
    await expect(page.getByTestId('probe-bundle')).toContainText('❌')
  })

  test('does not offer the download to a machine that could not run it', async ({ page }) => {
    // Headless Chromium has no WebGPU adapter, which is also most visitors. An
    // invitation to fetch half a gigabyte they cannot use is worse than silence,
    // so the banner is gated on `requestAdapter()` rather than on hope.
    await page.goto('interview')
    await expect(page.getByTestId('interviewer-card').first()).toBeVisible()

    await expect(page.getByTestId('engine-invite')).toHaveCount(0)
  })

  test('offers the download where the candidate already is, and takes no for an answer', async ({ page }) => {
    // The adapter is stubbed because the runner has none: what is under test is
    // the offer's own logic — shown when the device qualifies, gone for good
    // once waved away — not WebGPU.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: { requestAdapter: async () => ({ info: { vendor: 'test', description: 'stub' } }) },
      })
    })

    await page.goto('interview')
    const invite = page.getByTestId('engine-invite')
    await expect(invite).toBeVisible()
    await expect(invite).toContainText('locally')

    await page.getByTestId('engine-invite-prepare').click()
    await expect(page).toHaveURL(/\/engine$/)
    await expect(page.getByTestId('bundle-absent')).toBeVisible()

    await page.goBack()
    await page.getByTestId('engine-invite-dismiss').click()
    await expect(invite).toHaveCount(0)

    // Dismissed means dismissed — the offer does not come back on the next visit.
    await page.reload()
    await expect(page.getByTestId('interviewer-card').first()).toBeVisible()
    await expect(page.getByTestId('engine-invite')).toHaveCount(0)
  })

  test('an interview on a machine with no model runs the same as it always did', async ({ page }) => {
    // The state every CI run and most visitors are in. The on-device engine is
    // warmed in the background and never arrives; what must not happen is the
    // interview waiting for it, or claiming it is there.
    await page.goto('interview/recruiter')
    await waitForQuestion(page)

    const asked = await interviewerMessages(page).count()
    await page.getByTestId('chat-input').fill('Three stages, sharing a cache.')
    await page.getByTestId('send').click()

    // The next bank question still arrives, and promptly: the remark path is
    // skipped rather than awaited when there is no engine to produce one.
    await expect(interviewerMessages(page)).toHaveCount(asked + 1, { timeout: 15_000 })
    await expect(page.getByTestId('engine-badge')).toHaveCount(0)
  })

  test('never reaches for a CDN to load its runtime', async ({ page }) => {
    // MediaPipe's documented setup points `FilesetResolver` at jsdelivr. This
    // project already shipped that mistake once with Rive (DIA-181) on a page
    // holding camera permission, and `connect-src 'self'` now forbids it — but
    // a forbidden request is still an attempted one.
    const offOrigin: string[] = []
    // Captured before the listener runs: `page.url()` is still about:blank when
    // the first requests fire, and an empty host would call every one of them
    // third-party.
    const ourHost = new URL(test.info().project.use.baseURL!).host
    page.on('request', (request) => {
      if (new URL(request.url()).host !== ourHost) offOrigin.push(request.url())
    })

    await page.goto('engine')
    await page.getByTestId('engine-run').click()
    await expect(page.getByTestId('engine-verdict')).toBeVisible({ timeout: 30_000 })

    expect(offOrigin).toEqual([])
  })
})

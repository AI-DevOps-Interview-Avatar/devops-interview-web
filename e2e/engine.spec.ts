import { expect, test } from '@playwright/test'
import { seedLanguage } from './session'

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

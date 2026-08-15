/**
 * Runs the on-device engine against real weights, on real hardware.
 *
 * The one thing CI cannot do. MediaPipe's web runtime needs a WebGPU adapter
 * that a headless runner does not have, and the weights are 528 MB that no CI
 * job should be pulling on every push. So the acceptance suite asserts the
 * fallback — the state most visitors are in — and this script covers the other
 * half, by hand, when someone wants to know whether the model still answers.
 *
 * Usage:
 *
 *   1. Put the bundle where the app looks for it:
 *
 *        gh release download v1.5.0 --repo AI-DevOps-Interview-Avatar/devops-interview-app \
 *          --pattern '*.task' --dir public/models
 *
 *      `public/models/` is gitignored — and note that `npm run build` copies all
 *      of `public/`, so move it back out before building.
 *
 *      The other way, and the one a visitor uses: download the asset anywhere
 *      and import it on `/engine` (DIA-97). That stores it in the origin private
 *      file system, which is per browser profile — so a run driven by this
 *      script needs `launchPersistentContext`, since a fresh context starts with
 *      empty storage every time.
 *
 *   2. Serve the app, either `npm run dev` (port 5173) or a built
 *      `npx vite preview --port 4180`. Prefer the latter at least once: only
 *      the production build carries the CSP, and the runtime has to load under
 *      it. Pass the port with BASE_URL.
 *
 *   3. node scripts/engineLiveCheck.mjs
 *
 * On a machine whose GPU Chrome has blocklisted — anything with an older
 * integrated part — `navigator.gpu` exists but hands out no adapter, and the
 * app correctly reports `no-gpu-adapter`. FORCE_GPU=1 adds the flags that
 * override the blocklist, which is how this was verified on the development
 * laptop; see docs/on-device-llm.md for what that run produced.
 */
import { chromium } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4180/devops-interview-web/'
const UNBLOCK_GPU = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-angle=vulkan']

const browser = await chromium.launch({
  channel: 'chrome',
  // Headed on purpose: the headless shell ships no WebGPU at all, so a headless
  // run can only ever reproduce the fallback the e2e suite already covers.
  headless: false,
  args: process.env.FORCE_GPU ? UNBLOCK_GPU : [],
})

const page = await browser.newPage()
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

await page.goto(new URL('engine', BASE_URL).href)
await page.waitForSelector('[data-testid="probe-webgpu"]')
await page.waitForFunction(
  () => !document.querySelector('[data-testid="probe-bundle"]')?.textContent?.includes('…'),
  { timeout: 15_000 },
)

const read = async (id) => (await page.getByTestId(id).innerText()).trim()
console.log('WebGPU :', await read('probe-webgpu'))
console.log('SIMD   :', await read('probe-simd'))
console.log('Bundle :', await read('probe-bundle'))

await page.getByTestId('engine-run').click()
await page.waitForSelector('[data-testid="engine-verdict"]', { timeout: 180_000 })

const verdict = page.getByTestId('engine-verdict')
console.log('Verdict:', (await verdict.innerText()).trim(), `[kind=${await verdict.getAttribute('data-kind')}]`)

const started = Date.now()
await page
  .waitForFunction(
    () => (document.querySelector('[data-testid="engine-answer"]')?.textContent ?? '').trim().length > 0,
    { timeout: 600_000 },
  )
  .catch(() => console.log('(no token within ten minutes)'))
console.log(`First token after ${((Date.now() - started) / 1000).toFixed(1)}s`)

// Long enough to see it is a stream of tokens rather than one delivered blob.
await page.waitForTimeout(60_000)
console.log('Answer :', (await page.getByTestId('engine-answer').innerText()).trim().slice(0, 400))
console.log('Console errors:', errors.length ? errors : 'none')

await browser.close()

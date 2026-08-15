/**
 * The on-device model and how it is sampled — the web half of
 * `core/llm/LlmConfig.kt` in devops-interview-ai.
 *
 * Kept deliberately close to the Android values so an answer given by the
 * phone and an answer given by the browser are the same kind of answer. Where
 * the two runtimes genuinely differ, the difference is written down here rather
 * than discovered later from output that reads subtly wrong.
 */

/**
 * The bundle Android already ships, byte for byte: the asset attached to
 * `devops-interview-app` release v1.5.0.
 *
 * Whether this exact file runs under the *web* runtime is the open question of
 * this epic. MediaPipe's Web guide supports only models encoded for the GPU
 * backend and points at separately converted `-web.task` builds, and the
 * Android repo has already hit the mirror image of that problem — a `.litertlm`
 * exported for the web runtime failed the native engine's signature check. If
 * the answer turns out to be no, DIA-97 grows a conversion step and this
 * constant changes; nothing else here does.
 */
export const MODEL_FILE_NAME = 'Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task'

/** The release the asset is attached to, shown next to the download link. */
export const MODEL_RELEASE_TAG = 'v1.5.0'

/**
 * Where a person can get the bundle. A link for them to click — **not** a URL
 * this app can fetch.
 *
 * That distinction is the finding of DIA-116 and it cost this ticket its
 * original shape. GitHub sends no `Access-Control-Allow-Origin` on release
 * assets, on either hop: `github.com/…/releases/download/…` answers 302 with no
 * CORS header, and the `release-assets.githubusercontent.com` blob it points at
 * answers 206 with none either (checked 2026-08-15 with `Origin:
 * https://ai-devops-interview-avatar.github.io`). A browser therefore cannot
 * read these bytes from our origin at all, and no Content-Security-Policy of
 * ours changes that — CSP can only forbid a request the server was willing to
 * answer. `no-cors` is not a way out: an opaque response has no readable body,
 * which is the only part we want.
 *
 * Hence `importBundleFromFile` in `modelBundle.ts`: the candidate downloads this
 * URL the ordinary way and hands us the file. The integrity check the fetch
 * would have skipped happens either way, against `MODEL_SHA256`.
 */
export const MODEL_RELEASE_URL =
  `https://github.com/AI-DevOps-Interview-Avatar/devops-interview-app/releases/download/${MODEL_RELEASE_TAG}/${MODEL_FILE_NAME}`

/**
 * The bundle's size and digest, from the GitHub release asset metadata
 * (`GET /releases/tags/v1.5.0` → `size`, `digest`).
 *
 * Both are checked before anything is handed to MediaPipe, and the digest is
 * the one that matters: the weights arrive over a link this app does not
 * control, through a file picker, from a person who may well have fetched them
 * from wherever a search engine offered. A model file is executable in every
 * way that counts — it is the thing that will be asked to speak to a candidate
 * about their salary — and "it was the right size" is not provenance.
 */
export const MODEL_SIZE_BYTES = 554_661_246
export const MODEL_SHA256 = 'ddfaf1210d8b4d1b812b5fadb6652999e852c8be6dd9abe353b9213a25262c10'

/**
 * The same-origin path, still supported and still the fastest way to run the
 * engine on a development machine: drop the file in `public/models/` and it is
 * served under the Pages base path as `/devops-interview-web/models/<file>`.
 *
 * Not a deployment strategy — GitHub Pages caps a single file at 100 MB and a
 * site at 1 GB, and this file is 528 MB. It is what `scripts/engineLiveCheck.mjs`
 * has always used, and what the OPFS cache falls back to when it is empty.
 */
export function defaultModelUrl(baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/models/${MODEL_FILE_NAME}`
}

/**
 * Whether the weights are actually on this device.
 *
 * `response.ok` alone is not the question, and believing it cost an hour: a
 * static host that falls back to `index.html` for unknown paths answers a HEAD
 * for a missing bundle with 200 and a page of HTML. Vite's preview server does
 * exactly that, and so does any SPA host configured the usual way — the app
 * would then report the model as present and hand MediaPipe a document.
 *
 * A bundle is a bundle when the response is fine *and* the server does not
 * describe it as markup.
 */
export async function isModelBundlePresent(url = defaultModelUrl()): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) return false
    return !(response.headers.get('content-type') ?? '').includes('text/html')
  } catch {
    return false
  }
}

/**
 * Sampling, mirroring LlmConfig.kt.
 *
 * `maxTokens` covers input *and* output together — MediaPipe rejects the whole
 * request when the prompt alone exceeds the budget, rather than truncating the
 * generated part. That is the constraint DIA-99's PromptBuilder has to fit the
 * system prompt and the transcript into.
 *
 * `topP` is absent, and its absence is the one real divergence: Android sets
 * 0.95, but `LlmInferenceOptions` on the Web has no nucleus-sampling field at
 * all — only `topK` and `temperature`. Passing it would be silently ignored,
 * which is worse than not passing it, so the gap is recorded instead of faked.
 */
export const GENERATION_DEFAULTS = {
  maxTokens: 2048,
  topK: 40,
  temperature: 0.8,
  /** Fixed, so a persona asked the same thing twice does not answer differently for no reason. */
  randomSeed: 101,
} as const

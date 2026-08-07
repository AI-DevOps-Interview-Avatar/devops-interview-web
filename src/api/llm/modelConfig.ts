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

/**
 * Where the bundle is served from until DIA-97 fetches it from Releases and
 * caches it.
 *
 * Same-origin on purpose: `connect-src` is `'self'`, and a cross-origin fetch
 * of the weights is a policy change (DIA-116) rather than a URL change. Under
 * the Pages base path this resolves to `/devops-interview-web/models/<file>`.
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

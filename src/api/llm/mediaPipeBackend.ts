import type { LlmBackend } from '../llmClient'
import { detectEngineSupport, type UnsupportedReason } from './capabilities'
import { GENERATION_DEFAULTS, defaultModelUrl, isModelBundlePresent } from './modelConfig'

/** Why an on-device session could not start, in a form the UI can translate. */
export type LlmFailure = UnsupportedReason | 'model-unavailable' | 'engine-error'

export class LlmUnavailableError extends Error {
  readonly reason: LlmFailure

  constructor(reason: LlmFailure, cause?: unknown) {
    super(`on-device LLM unavailable: ${reason}`, { cause })
    this.name = 'LlmUnavailableError'
    this.reason = reason
  }
}

/** The slice of MediaPipe's LlmInference this backend uses. */
interface Inference {
  generateResponse(query: string, listener?: (partial: string, done: boolean) => unknown): Promise<string>
  close(): void
}

export interface MediaPipeBackendOptions {
  /** Defaults to the same-origin bundle path; DIA-97 will hand in a cached blob URL instead. */
  modelUrl?: string
  maxTokens?: number
  topK?: number
  temperature?: number
  randomSeed?: number
}

/**
 * Gemma 3 1B in the browser, through MediaPipe's LLM Inference Web API.
 *
 * The counterpart of `LiteRtLmEngine` on Android and `LlamaCppBackend` on Apple:
 * same model, same sampling, no server. Nothing is sent anywhere — which is the
 * whole point of an app that asks a candidate for their salary expectations.
 *
 * This class is the engine only. It takes a prompt and streams tokens back; it
 * does not know what an interview is. Turning a transcript into a prompt is
 * DIA-99's PromptBuilder, and getting the weights onto the device is DIA-97 —
 * until that lands, `init()` fails with `model-unavailable` on any machine that
 * has not been handed a bundle by hand, and the caller falls back to the mock.
 */
export class MediaPipeLlmBackend implements LlmBackend {
  private inference: Inference | null = null
  private generating = false
  private readonly options: Required<MediaPipeBackendOptions>

  constructor(options: MediaPipeBackendOptions = {}) {
    this.options = {
      modelUrl: options.modelUrl ?? defaultModelUrl(),
      maxTokens: options.maxTokens ?? GENERATION_DEFAULTS.maxTokens,
      topK: options.topK ?? GENERATION_DEFAULTS.topK,
      temperature: options.temperature ?? GENERATION_DEFAULTS.temperature,
      randomSeed: options.randomSeed ?? GENERATION_DEFAULTS.randomSeed,
    }
  }

  /**
   * Order matters and is the point: capabilities first, then 27 MB of runtime,
   * then half a gigabyte of weights. A machine without a GPU adapter finds out
   * before it has downloaded anything at all.
   */
  async init(): Promise<void> {
    if (this.inference) return

    const support = await detectEngineSupport()
    if (!support.supported) throw new LlmUnavailableError(support.reason ?? 'no-webgpu')

    // Both dynamic, and for the same reason: the glue is ~60 kB and the WASM
    // behind the fileset is 27 MB. Neither belongs in a chunk that loads for a
    // candidate who only ever opens the practice screen — and neither belongs
    // anywhere near the entry chunk (DIA-134).
    const [{ LlmInference }, { resolveGenAiFileset }] = await Promise.all([
      import('@mediapipe/tasks-genai'),
      import('./genaiFileset'),
    ])

    try {
      this.inference = (await LlmInference.createFromOptions(resolveGenAiFileset(), {
        baseOptions: { modelAssetPath: this.options.modelUrl },
        maxTokens: this.options.maxTokens,
        topK: this.options.topK,
        temperature: this.options.temperature,
        randomSeed: this.options.randomSeed,
      })) as unknown as Inference
    } catch (error) {
      // A missing bundle and a corrupt one arrive as the same rejected promise,
      // so the URL is probed rather than guessed at from the message text.
      throw new LlmUnavailableError(await this.classifyStartupFailure(), error)
    }
  }

  /**
   * Streams a completion for `prompt`.
   *
   * Note the contract difference from `MockLlmBackend`, which is handed the
   * finished sentence and merely paces it out: here the argument is a real
   * prompt and the return value is the model's own words.
   */
  async generate(prompt: string, onToken: (token: string) => void): Promise<string> {
    if (!this.inference) throw new LlmUnavailableError('engine-error')
    // One graph, one conversation: a second concurrent call corrupts the shared
    // KV cache rather than queueing behind the first.
    if (this.generating) throw new LlmUnavailableError('engine-error')

    this.generating = true
    try {
      return await this.inference.generateResponse(prompt, (partial) => {
        if (partial) onToken(partial)
      })
    } catch (error) {
      throw new LlmUnavailableError('engine-error', error)
    } finally {
      this.generating = false
    }
  }

  /**
   * Releases the graph and the weights behind it.
   *
   * Not optional housekeeping: the bundle is hundreds of megabytes of GPU
   * memory, and leaving one session open while another starts is how a second
   * interview fails to load on a machine where the first worked.
   */
  close(): void {
    this.inference?.close()
    this.inference = null
    this.generating = false
  }

  /**
   * Distinguishes "no weights on this device" from "the engine broke".
   *
   * By probing the URL, not by matching on the message: MediaPipe reports a
   * missing bundle, a truncated download and a model encoded for the wrong
   * backend through the same rejected promise, and its wording is not ours to
   * depend on across versions.
   */
  private async classifyStartupFailure(): Promise<LlmFailure> {
    return (await isModelBundlePresent(this.options.modelUrl)) ? 'engine-error' : 'model-unavailable'
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmUnavailableError, MediaPipeLlmBackend } from './mediaPipeBackend'
import { GENERATION_DEFAULTS } from './modelConfig'

/**
 * MediaPipe is stubbed; the model is not involved.
 *
 * Everything asserted below is our own behaviour around the engine — the order
 * things are attempted in, what a failure is reported as, and what happens to a
 * session that is closed or asked for two answers at once. None of it depends
 * on the weights, and requiring them would make this suite unrunnable in CI.
 */
const createFromOptions = vi.fn()
const close = vi.fn()

vi.mock('@mediapipe/tasks-genai', () => ({
  LlmInference: { createFromOptions: (...args: unknown[]) => createFromOptions(...args) },
}))

vi.mock('./genaiFileset', () => ({
  resolveGenAiFileset: () => ({ wasmLoaderPath: '/assets/genai.js', wasmBinaryPath: '/assets/genai.wasm' }),
}))

/** An inference handle that streams `chunks` and then resolves with the whole text. */
function inferenceYielding(chunks: string[]) {
  return {
    close,
    generateResponse: vi.fn(async (_query: string, listener?: (partial: string, done: boolean) => unknown) => {
      for (const chunk of chunks) listener?.(chunk, false)
      listener?.('', true)
      return chunks.join('')
    }),
  }
}

function withGpu() {
  vi.stubGlobal('navigator', { gpu: { requestAdapter: () => Promise.resolve({}) } })
}

/** A HEAD response for the bundle probe: status, and how the server describes the body. */
function stubHead({ ok = true, contentType = 'application/octet-stream' } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, headers: new Headers({ 'content-type': contentType }) } as Response)),
  )
}

beforeEach(() => {
  withGpu()
  stubHead()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('starting a session', () => {
  it('checks the GPU before fetching anything', async () => {
    vi.stubGlobal('navigator', { gpu: undefined })

    await expect(new MediaPipeLlmBackend().init()).rejects.toMatchObject({ reason: 'no-webgpu' })
    // The point of the ordering: nothing was downloaded to learn this.
    expect(createFromOptions).not.toHaveBeenCalled()
  })

  it('passes the Android sampling values through', async () => {
    createFromOptions.mockResolvedValue(inferenceYielding(['ok']))

    await new MediaPipeLlmBackend({ modelUrl: '/models/gemma.task' }).init()

    expect(createFromOptions).toHaveBeenCalledWith(expect.anything(), {
      baseOptions: { modelAssetPath: '/models/gemma.task' },
      maxTokens: GENERATION_DEFAULTS.maxTokens,
      topK: GENERATION_DEFAULTS.topK,
      temperature: GENERATION_DEFAULTS.temperature,
      randomSeed: GENERATION_DEFAULTS.randomSeed,
    })
  })

  it('calls a missing bundle model-unavailable, not an engine fault', async () => {
    createFromOptions.mockRejectedValue(new Error('RET_CHECK failure'))
    stubHead({ ok: false })

    await expect(new MediaPipeLlmBackend().init()).rejects.toMatchObject({ reason: 'model-unavailable' })
  })

  it('is not fooled by an SPA host answering 200 with its index page', async () => {
    // Vite's preview server does this, and so does any static host with an
    // SPA fallback: a HEAD for a bundle that is not there comes back 200 with
    // a page of HTML. Trusting `response.ok` reported the model as present.
    createFromOptions.mockRejectedValue(new Error('failed to load model'))
    stubHead({ ok: true, contentType: 'text/html; charset=utf-8' })

    await expect(new MediaPipeLlmBackend().init()).rejects.toMatchObject({ reason: 'model-unavailable' })
  })

  it('calls a present-but-unusable bundle an engine error', async () => {
    // The shape of the open question in this epic: the weights are right there,
    // and the runtime still refuses them — a model encoded for the wrong
    // backend looks exactly like this.
    createFromOptions.mockRejectedValue(new Error('unsupported model format'))

    await expect(new MediaPipeLlmBackend().init()).rejects.toMatchObject({ reason: 'engine-error' })
  })

  it('is idempotent — a second init does not build a second graph', async () => {
    createFromOptions.mockResolvedValue(inferenceYielding(['ok']))
    const backend = new MediaPipeLlmBackend()

    await backend.init()
    await backend.init()

    expect(createFromOptions).toHaveBeenCalledTimes(1)
  })
})

describe('generating an answer', () => {
  it('streams partials as they arrive and returns the whole thing', async () => {
    createFromOptions.mockResolvedValue(inferenceYielding(['Kuber', 'netes ', 'scales.']))
    const backend = new MediaPipeLlmBackend()
    await backend.init()

    const tokens: string[] = []
    const answer = await backend.generate('Explain autoscaling.', (token) => tokens.push(token))

    expect(tokens).toEqual(['Kuber', 'netes ', 'scales.'])
    expect(answer).toBe('Kubernetes scales.')
  })

  it('refuses a second answer while the first is still coming', async () => {
    // One graph, one KV cache. Two concurrent calls do not queue — they corrupt
    // each other's context, and the second interview answers the first question.
    let release = () => {}
    createFromOptions.mockResolvedValue({
      close,
      generateResponse: () => new Promise<string>((resolve) => (release = () => resolve('done'))),
    })
    const backend = new MediaPipeLlmBackend()
    await backend.init()

    const first = backend.generate('one', () => {})
    await expect(backend.generate('two', () => {})).rejects.toBeInstanceOf(LlmUnavailableError)

    release()
    await expect(first).resolves.toBe('done')
  })

  it('accepts the next question once the previous answer finished', async () => {
    createFromOptions.mockResolvedValue(inferenceYielding(['a']))
    const backend = new MediaPipeLlmBackend()
    await backend.init()

    await backend.generate('one', () => {})
    await expect(backend.generate('two', () => {})).resolves.toBe('a')
  })

  it('unblocks after a failed generation rather than wedging the session', async () => {
    createFromOptions.mockResolvedValue({
      close,
      generateResponse: vi.fn().mockRejectedValueOnce(new Error('OOM')).mockResolvedValueOnce('recovered'),
    })
    const backend = new MediaPipeLlmBackend()
    await backend.init()

    await expect(backend.generate('one', () => {})).rejects.toBeInstanceOf(LlmUnavailableError)
    await expect(backend.generate('two', () => {})).resolves.toBe('recovered')
  })

  it('fails clearly when asked before init', async () => {
    await expect(new MediaPipeLlmBackend().generate('hello', () => {})).rejects.toBeInstanceOf(LlmUnavailableError)
  })
})

describe('ending a session', () => {
  it('releases the graph, and can be started again afterwards', async () => {
    createFromOptions.mockResolvedValue(inferenceYielding(['ok']))
    const backend = new MediaPipeLlmBackend()

    await backend.init()
    backend.close()
    expect(close).toHaveBeenCalledTimes(1)

    // Hundreds of megabytes of GPU memory: leaving the first session open is
    // how the second interview fails to load on a machine the first worked on.
    await backend.init()
    expect(createFromOptions).toHaveBeenCalledTimes(2)
  })

  it('is safe to call without a session', () => {
    expect(() => new MediaPipeLlmBackend().close()).not.toThrow()
  })
})

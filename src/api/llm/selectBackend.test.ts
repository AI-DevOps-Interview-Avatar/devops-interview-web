import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectLlmBackend } from './selectBackend'
import { LlmUnavailableError } from './mediaPipeBackend'

/**
 * The engine is mocked at the class boundary, not at MediaPipe's.
 *
 * What matters here is the decision — which backend a caller ends up holding
 * and whether it is told why — and that decision has to hold for reasons this
 * machine cannot produce on demand: no WebGPU, no adapter, no weights. Driving
 * it through the real class would mean 27 MB of WASM and half a gigabyte of
 * model in a unit test, to assert something neither of them influences.
 */
const init = vi.fn()
const close = vi.fn()

vi.mock('./mediaPipeBackend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mediaPipeBackend')>()
  return {
    ...actual,
    MediaPipeLlmBackend: class {
      init = init
      close = close
      generate = vi.fn()
    },
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('picking an engine for this machine', () => {
  it('uses the on-device model when it starts', async () => {
    init.mockResolvedValue(undefined)

    const selection = await selectLlmBackend()

    expect(selection.kind).toBe('mediapipe')
    expect(selection.fallbackReason).toBeUndefined()
  })

  it('falls back to the script, and says why, when there are no weights yet', async () => {
    // The state every machine is in until DIA-97 lands.
    init.mockRejectedValue(new LlmUnavailableError('model-unavailable'))

    const selection = await selectLlmBackend()

    expect(selection.kind).toBe('mock')
    expect(selection.fallbackReason).toBe('model-unavailable')
  })

  it('carries the capability reason through, not a generic one', async () => {
    init.mockRejectedValue(new LlmUnavailableError('no-gpu-adapter'))

    const selection = await selectLlmBackend()

    expect(selection.fallbackReason).toBe('no-gpu-adapter')
  })

  it('closes the half-built session instead of leaking its GPU memory', async () => {
    init.mockRejectedValue(new LlmUnavailableError('engine-error'))

    await selectLlmBackend()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('reports engine-error for a failure that is not ours', async () => {
    // A TypeError out of the runtime is still a failure to start, and the
    // caller gets a working interview either way.
    init.mockRejectedValue(new TypeError('undefined is not a function'))

    const selection = await selectLlmBackend()

    expect(selection.kind).toBe('mock')
    expect(selection.fallbackReason).toBe('engine-error')
  })

  it('skips the WebGPU probe entirely when the mock is asked for', async () => {
    const selection = await selectLlmBackend({ preferMock: true })

    expect(selection.kind).toBe('mock')
    expect(selection.fallbackReason).toBeUndefined()
    expect(init).not.toHaveBeenCalled()
  })

  it('returns a backend that is already initialised', async () => {
    // Both paths await init before returning; a caller that had to remember to
    // do it itself would work with the mock and fail with the real one.
    const tokens: string[] = []
    const selection = await selectLlmBackend({ preferMock: true })
    await selection.backend.generate('two words', (token) => tokens.push(token))

    expect(tokens.join('')).toBe('two words ')
  })
})

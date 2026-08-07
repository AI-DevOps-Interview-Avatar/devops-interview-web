import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectEngineSupport, isSimdSupported } from './capabilities'

/** Replaces `navigator` with one whose `gpu` behaves as a test wants. */
function stubGpu(gpu: unknown) {
  vi.stubGlobal('navigator', { ...globalThis.navigator, gpu })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deciding whether this browser can run the model at all', () => {
  it('rules out an engine with no SIMD before it touches the GPU', async () => {
    // Only the SIMD runtime is shipped (genaiFileset.ts), so this is a hard
    // requirement rather than a slower path — and it is answered without
    // waiting on an adapter request.
    const requestAdapter = vi.fn()
    stubGpu({ requestAdapter })
    vi.stubGlobal('WebAssembly', { validate: () => false })

    await expect(detectEngineSupport()).resolves.toEqual({ supported: false, reason: 'no-simd' })
    expect(requestAdapter).not.toHaveBeenCalled()
  })

  it('reports no-webgpu when the API is missing', async () => {
    stubGpu(undefined)

    await expect(detectEngineSupport()).resolves.toEqual({ supported: false, reason: 'no-webgpu' })
  })

  it('reports no-gpu-adapter when WebGPU exists but hands out nothing', async () => {
    // The case that makes `'gpu' in navigator` a bad test: Chrome exposes the
    // object on a blocklisted driver, in a VM, and in our own headless e2e run,
    // then resolves the adapter request to null.
    stubGpu({ requestAdapter: () => Promise.resolve(null) })

    await expect(detectEngineSupport()).resolves.toEqual({ supported: false, reason: 'no-gpu-adapter' })
  })

  it('treats a throwing requestAdapter as unsupported rather than retrying', async () => {
    stubGpu({
      requestAdapter: () => Promise.reject(new Error('driver went away')),
    })

    await expect(detectEngineSupport()).resolves.toEqual({ supported: false, reason: 'gpu-error' })
  })

  it('passes, and names the adapter, when one is granted', async () => {
    stubGpu({
      requestAdapter: () => Promise.resolve({ info: { vendor: 'nvidia', description: 'GeForce 940M' } }),
    })

    await expect(detectEngineSupport()).resolves.toEqual({
      supported: true,
      adapter: 'nvidia GeForce 940M',
    })
  })

  it('still passes when the adapter declines to describe itself', async () => {
    // `adapter.info` is behind a permissions policy in some builds; an
    // anonymous adapter is a working one.
    stubGpu({ requestAdapter: () => Promise.resolve({}) })

    await expect(detectEngineSupport()).resolves.toEqual({ supported: true, adapter: undefined })
  })
})

describe('choosing between the SIMD and nosimd runtime', () => {
  it('answers from the engine rather than the user agent', () => {
    // Node ships SIMD, so this asserts the probe is a valid module and gets a
    // real answer — a malformed one would fail validation and quietly send
    // every machine to the fallback binary.
    expect(isSimdSupported()).toBe(true)
  })

  it('says no rather than throwing when WebAssembly is unavailable', () => {
    vi.stubGlobal('WebAssembly', {
      validate: () => {
        throw new Error('no WebAssembly here')
      },
    })

    expect(isSimdSupported()).toBe(false)
  })
})

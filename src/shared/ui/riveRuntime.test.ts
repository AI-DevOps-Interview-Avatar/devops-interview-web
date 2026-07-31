import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@rive-app/react-canvas', () => ({
  RuntimeLoader: { setWasmUrl: vi.fn(), setWasmFallbackUrl: vi.fn() },
}))

const { RuntimeLoader } = await import('@rive-app/react-canvas')
const { initRiveRuntime } = await import('./riveRuntime')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('initRiveRuntime', () => {
  it('serves both WASM binaries from our own origin', () => {
    initRiveRuntime()

    const urls = [
      vi.mocked(RuntimeLoader.setWasmUrl).mock.calls[0][0],
      vi.mocked(RuntimeLoader.setWasmFallbackUrl).mock.calls[0][0],
    ]
    for (const url of urls) {
      expect(url).toMatch(/\.wasm$/)
      // The whole point of the ticket: no unpkg, no jsDelivr, no absolute
      // origin of any kind on a page that holds camera permission.
      expect(url).not.toMatch(/^[a-z]+:\/\//)
    }
    expect(urls[0]).not.toBe(urls[1])
  })

  it('keeps the fallback rather than disabling it', () => {
    initRiveRuntime()

    // Passing null would switch the fallback off entirely. It exists for
    // architectures the primary binary cannot run on, which are exactly the
    // machines that would otherwise be left with no avatars at all.
    expect(RuntimeLoader.setWasmFallbackUrl).toHaveBeenCalledTimes(1)
    expect(vi.mocked(RuntimeLoader.setWasmFallbackUrl).mock.calls[0][0]).not.toBeNull()
  })
})

/**
 * What this browser can actually run, asked before anything heavy is fetched.
 *
 * MediaPipe's Web LLM runtime only supports models encoded for the GPU backend,
 * so WebGPU is not an optimisation here — it is the difference between working
 * and not. Finding that out *after* pulling half a gigabyte of weights is the
 * failure mode this module exists to avoid.
 */

/** Why the on-device engine cannot run, in a form the UI can translate. */
export type UnsupportedReason =
  /** No `navigator.gpu` at all — Firefox and Safari on older releases, or a non-secure context. */
  | 'no-webgpu'
  /** WebGPU is present but hands out no adapter: software renderers, blocklisted drivers, headless CI. */
  | 'no-gpu-adapter'
  /** `requestAdapter()` threw. Treated as unsupported rather than retried — it means a broken driver. */
  | 'gpu-error'
  /** No WASM SIMD. Only the SIMD runtime is shipped — see genaiFileset.ts. */
  | 'no-simd'

export interface EngineSupport {
  supported: boolean
  reason?: UnsupportedReason
  /** Adapter description when we got one, for the diagnostics screen. */
  adapter?: string
}

/**
 * The seven-byte question "does this engine do SIMD": a module whose single
 * function returns a v128. Validation is synchronous and does not instantiate
 * anything, so it is safe to ask on the main thread.
 *
 * Taken from the wasm-feature-detect probe rather than sniffing user agents,
 * which is how the nosimd build ends up shipped to machines that never needed
 * it — and, worse, the other way round.
 */
const SIMD_PROBE = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
])

export function isSimdSupported(): boolean {
  try {
    return WebAssembly.validate(SIMD_PROBE)
  } catch {
    return false
  }
}

interface GpuNavigator {
  gpu?: { requestAdapter(): Promise<{ info?: { description?: string; vendor?: string } } | null> }
}

/**
 * Asks for a GPU adapter, which is the only honest test.
 *
 * `'gpu' in navigator` is not one: Chrome exposes the object on machines where
 * `requestAdapter()` resolves to null — a blocklisted driver, a VM with a
 * software rasteriser, or the headless browser our own e2e suite runs in.
 */
export async function detectEngineSupport(): Promise<EngineSupport> {
  // Synchronous and free, so it goes first. In practice it never fires on a
  // machine that would have passed the GPU check — SIMD has been baseline
  // since 2021 and WebGPU since 2023 — but we ship only the SIMD runtime, so
  // the assumption is stated rather than left implicit.
  if (!isSimdSupported()) return { supported: false, reason: 'no-simd' }

  const gpu = (navigator as unknown as GpuNavigator).gpu
  if (!gpu) return { supported: false, reason: 'no-webgpu' }

  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return { supported: false, reason: 'no-gpu-adapter' }

    const info = adapter.info
    return {
      supported: true,
      adapter: [info?.vendor, info?.description].filter(Boolean).join(' ') || undefined,
    }
  } catch {
    return { supported: false, reason: 'gpu-error' }
  }
}

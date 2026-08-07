// Resolved by Vite at build time and emitted into our own `assets/` folder with
// the Pages base path applied, so the binary can never drift away from the JS
// glue that instantiates it — they move together or not at all.
import wasmLoaderUrl from '@mediapipe/tasks-genai/genai_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-genai/genai_wasm_internal.wasm?url'

/**
 * The shape `LlmInference.createFromOptions` wants. Declared here rather than
 * imported: the package exposes the interface only as an internal declaration,
 * and a structural literal satisfies the call either way.
 */
export interface GenAiWasmFileset {
  wasmLoaderPath: string
  wasmBinaryPath: string
}

/**
 * Points MediaPipe at our own copy of its WebAssembly runtime.
 *
 * `FilesetResolver.forGenAiTasks(basePath)` is the documented path and it does
 * not fit here. It takes a *directory* and builds the filenames itself, while
 * Vite emits content-hashed assets — there is no directory whose contents match
 * what the resolver would ask for. The docs' own escape hatch is a hand-built
 * fileset, which is what this is.
 *
 * The alternative was the default: `https://cdn.jsdelivr.net/npm/@mediapipe/
 * tasks-genai/wasm`. This project already learned that lesson once — DIA-181
 * pulled the Rive runtime off unpkg for exactly this reason, and `connect-src`
 * has been `'self'` ever since. A CDN inside the trust boundary of a page
 * holding camera and microphone grants is not a trade worth 27 MB of bandwidth,
 * and `e2e/shell.spec.ts` fails the build if anything reaches for one.
 *
 * Only the SIMD build is shipped. The package also carries a `nosimd` variant,
 * and on this engine it is unreachable: MediaPipe's web runtime requires
 * WebGPU, which no browser shipped before 2023, while WASM SIMD has been
 * baseline since 2021. Emitting it cost 80 kB gzipped of loader glue that no
 * machine capable of running the model would ever fetch.
 */
export function resolveGenAiFileset(): GenAiWasmFileset {
  return { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
}

import { RuntimeLoader } from '@rive-app/react-canvas'
// Resolved by Vite at build time and emitted into our own `assets/` folder with
// the Pages base path applied. The version therefore follows whatever
// `@rive-app/canvas` npm has installed — nothing to bump by hand, and no way for
// the binary to drift away from the JS runtime that instantiates it.
import wasmUrl from '@rive-app/canvas/rive.wasm?url'
import fallbackWasmUrl from '@rive-app/canvas/rive_fallback.wasm?url'

/**
 * Points Rive at our own copy of its WebAssembly runtime.
 *
 * `@rive-app/react-canvas` ships no WASM inside the bundle: on the first
 * `useRive()` the loader fetches `https://unpkg.com/@rive-app/canvas@<version>/rive.wasm`,
 * with jsDelivr behind it. That put a third party inside the trust boundary of a
 * page holding camera and microphone permission, and made every avatar depend on
 * a CDN having a good day — silently, since a failed rig is just an empty canvas.
 *
 * Both defaults are still compiled into the bundle as unused strings. That is
 * fine and even useful: `connect-src` no longer allows either origin, so if this
 * module ever stops running the avatars fail with a CSP violation in the console
 * instead of quietly phoning out to unpkg again.
 *
 * Must run before the first `useRive()` — the loader caches its instance, and a
 * URL set afterwards would apply to nothing.
 */
export function initRiveRuntime(): void {
  RuntimeLoader.setWasmUrl(wasmUrl)
  // Kept rather than disabled: this is the build for architectures without the
  // WASM features the primary binary assumes, and it is the one machine class
  // that would otherwise lose its avatars entirely.
  RuntimeLoader.setWasmFallbackUrl(fallbackWasmUrl)
}

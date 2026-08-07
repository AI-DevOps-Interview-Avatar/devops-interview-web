import { MockLlmBackend, type LlmBackend } from '../llmClient'
import { LlmUnavailableError, MediaPipeLlmBackend, type LlmFailure, type MediaPipeBackendOptions } from './mediaPipeBackend'

export interface BackendSelection {
  backend: LlmBackend
  kind: 'mediapipe' | 'mock'
  /** Set when the on-device engine was asked for and could not start. */
  fallbackReason?: LlmFailure
}

export interface SelectBackendOptions extends MediaPipeBackendOptions {
  /**
   * Skips the on-device attempt entirely.
   *
   * The e2e suite runs headless, where `requestAdapter()` returns null anyway —
   * but relying on that would make every acceptance test wait out a WebGPU
   * probe to reach a conclusion it could have been told.
   */
  preferMock?: boolean
}

/**
 * Picks the engine this machine can actually run, and says which one it picked.
 *
 * Falling back rather than failing is deliberate. The interview is the product;
 * on a laptop with no WebGPU adapter, or before DIA-97 has put a bundle on the
 * device, a scripted interview is worth more than an error screen. What would
 * not be acceptable is doing that silently — hence `kind` and `fallbackReason`,
 * so the UI can say which interviewer the candidate is actually talking to.
 */
export async function selectLlmBackend(options: SelectBackendOptions = {}): Promise<BackendSelection> {
  const { preferMock, ...backendOptions } = options

  if (preferMock) {
    const backend = new MockLlmBackend()
    await backend.init()
    return { backend, kind: 'mock' }
  }

  const onDevice = new MediaPipeLlmBackend(backendOptions)
  try {
    await onDevice.init()
    return { backend: onDevice, kind: 'mediapipe' }
  } catch (error) {
    // A half-built session still holds its graph; dropping the reference would
    // leak the GPU memory behind it.
    onDevice.close()

    const fallback = new MockLlmBackend()
    await fallback.init()
    return {
      backend: fallback,
      kind: 'mock',
      fallbackReason: error instanceof LlmUnavailableError ? error.reason : 'engine-error',
    }
  }
}

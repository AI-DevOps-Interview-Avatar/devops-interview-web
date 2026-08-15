import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256Hex } from '../../shared/lib/sha256'

/**
 * The real bundle is 528 MB, so these tests use a 24-byte one.
 *
 * `modelConfig` is mocked to describe that file instead — same shape, same
 * checks, four hundred thousand times smaller. What is being asserted is the
 * part that has nothing to do with size: that a file failing verification never
 * becomes visible to the engine, and never stays on the disk either.
 */
const BUNDLE_BYTES = new TextEncoder().encode('gemma weights, honest.')

vi.mock('./modelConfig', () => ({
  MODEL_FILE_NAME: 'test-bundle.task',
  MODEL_SIZE_BYTES: BUNDLE_BYTES.length,
  MODEL_SHA256: sha256Hex(BUNDLE_BYTES),
}))

const {
  BundleError,
  checkStorageHeadroom,
  importBundle,
  importBundleFromFile,
  isBundleStorageAvailable,
  readStoredBundle,
  removeStoredBundle,
} = await import('./modelBundle')

/** An in-memory origin private file system: enough of the API for this module. */
function fakeOpfs() {
  const files = new Map<string, Uint8Array<ArrayBuffer>>()

  const root = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException('not found', 'NotFoundError')
        files.set(name, new Uint8Array(0))
      }
      return {
        async getFile() {
          return new Blob([files.get(name)!])
        },
        async createWritable() {
          let staged: Uint8Array<ArrayBuffer>[] = []
          return {
            async write(chunk: Uint8Array<ArrayBuffer> | string) {
              // The real writable takes strings too, and encodes them as UTF-8 —
              // which is how the meta record is written.
              staged.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk.slice())
            },
            async close() {
              const size = staged.reduce((total, chunk) => total + chunk.length, 0)
              const merged = new Uint8Array(size)
              let at = 0
              for (const chunk of staged) {
                merged.set(chunk, at)
                at += chunk.length
              }
              files.set(name, merged)
            },
            async abort() {
              staged = []
            },
          }
        },
      }
    },
    async removeEntry(name: string) {
      if (!files.delete(name)) throw new DOMException('not found', 'NotFoundError')
    },
  }

  return { root, files }
}

let opfs: ReturnType<typeof fakeOpfs>

function stubStorage({ quota = 10_000_000, usage = 0 } = {}) {
  opfs = fakeOpfs()
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: () => Promise.resolve(opfs.root),
      estimate: () => Promise.resolve({ quota, usage }),
      persist: () => Promise.resolve(true),
    },
  })
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:stored-bundle', revokeObjectURL: () => {} })
}

const stored = () => opfs.files.get('test-bundle.task')
const meta = () => opfs.files.get('bundle.meta.json')

beforeEach(() => stubStorage())
afterEach(() => vi.unstubAllGlobals())

describe('importing a bundle', () => {
  it('stores the file and reports it as available afterwards', async () => {
    const result = await importBundleFromFile(new Blob([BUNDLE_BYTES]))

    expect(result.sizeBytes).toBe(BUNDLE_BYTES.length)
    expect(result.url).toBe('blob:stored-bundle')
    expect(stored()).toEqual(BUNDLE_BYTES)

    const found = await readStoredBundle()
    expect(found?.sizeBytes).toBe(BUNDLE_BYTES.length)
  })

  it('reports progress as the bytes arrive, not once at the end', async () => {
    const seen: number[] = []
    // Three chunks out of one Blob: Blob.stream() would hand over the lot in
    // one, and a progress bar that only ever fires at 100% is not one.
    const chunked = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(BUNDLE_BYTES.subarray(0, 8))
        controller.enqueue(BUNDLE_BYTES.subarray(8, 16))
        controller.enqueue(BUNDLE_BYTES.subarray(16))
        controller.close()
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: chunked,
        headers: new Headers({ 'content-length': String(BUNDLE_BYTES.length) }),
      })),
    )

    await importBundle({ kind: 'url', url: '/models/test-bundle.task' }, {
      onProgress: (progress) => seen.push(progress.receivedBytes),
    })

    expect(seen).toEqual([8, 16, BUNDLE_BYTES.length])
  })

  it('deletes a file whose digest does not match, and never records it', async () => {
    // The case the whole module is built around: right name, right size, wrong
    // bytes. Nothing about the file itself says so.
    const tampered = Uint8Array.from(BUNDLE_BYTES)
    tampered[0] ^= 0xff

    await expect(importBundleFromFile(new Blob([tampered]))).rejects.toMatchObject({
      reason: 'checksum-mismatch',
    })

    expect(stored()).toBeUndefined()
    expect(meta()).toBeUndefined()
    expect(await readStoredBundle()).toBeNull()
  })

  it('rejects a file of the wrong length before it bothers hashing it', async () => {
    await expect(importBundleFromFile(new Blob([BUNDLE_BYTES.subarray(0, 10)]))).rejects.toMatchObject({
      reason: 'wrong-size',
    })
    expect(await readStoredBundle()).toBeNull()
  })

  it('refuses to start when the device has no room for the file', async () => {
    stubStorage({ quota: BUNDLE_BYTES.length, usage: BUNDLE_BYTES.length - 1 })

    await expect(importBundleFromFile(new Blob([BUNDLE_BYTES]))).rejects.toMatchObject({
      reason: 'insufficient-space',
    })
    // Asked before the first byte: nothing was written to find that out.
    expect(stored()).toBeUndefined()
  })

  it('treats an unknown quota as room enough rather than blocking the device', async () => {
    stubStorage({ quota: 0, usage: 0 })
    expect((await checkStorageHeadroom()).sufficient).toBe(true)
  })

  it('leaves nothing behind when cancelled part-way', async () => {
    const controller = new AbortController()
    const slow = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        streamController.enqueue(BUNDLE_BYTES.subarray(0, 8))
        controller.abort()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: slow, headers: new Headers() })),
    )

    await expect(
      importBundle({ kind: 'url', url: '/models/test-bundle.task' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ reason: 'cancelled' })

    expect(stored()).toBeUndefined()
    expect(await readStoredBundle()).toBeNull()
  })

  it('does not store an HTML error page that a static host served as the bundle', async () => {
    // Vite preview and GitHub Pages both answer an unknown path with index.html
    // and a 200. Believing that once already had the app reporting a model it
    // did not have (see isModelBundlePresent).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: new Blob(['<!doctype html>']).stream(),
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      })),
    )

    await expect(importBundle({ kind: 'url', url: '/models/missing.task' })).rejects.toMatchObject({
      reason: 'wrong-size',
    })
  })
})

describe('reading what is already stored', () => {
  it('discards a bundle recorded for a different model', async () => {
    await importBundleFromFile(new Blob([BUNDLE_BYTES]))

    const record = JSON.parse(new TextDecoder().decode(meta()!))
    opfs.files.set('bundle.meta.json', new TextEncoder().encode(JSON.stringify({ ...record, sha256: 'older' })))

    expect(await readStoredBundle()).toBeNull()
    // And the weights go with it: 528 MB of a model nothing can use is not
    // something to leave on a candidate's disk.
    expect(stored()).toBeUndefined()
  })

  it('discards a file cut short by a tab that closed mid-write', async () => {
    await importBundleFromFile(new Blob([BUNDLE_BYTES]))
    opfs.files.set('test-bundle.task', BUNDLE_BYTES.subarray(0, 12))

    expect(await readStoredBundle()).toBeNull()
  })

  it('reports nothing stored, rather than throwing, when the browser has no OPFS', async () => {
    vi.stubGlobal('navigator', {})

    expect(isBundleStorageAvailable()).toBe(false)
    expect(await readStoredBundle()).toBeNull()
    await expect(importBundleFromFile(new Blob([BUNDLE_BYTES]))).rejects.toMatchObject({ reason: 'no-storage' })
  })

  it('removes a stored bundle on request, and is quiet when there is none', async () => {
    await importBundleFromFile(new Blob([BUNDLE_BYTES]))
    await removeStoredBundle()

    expect(await readStoredBundle()).toBeNull()
    await expect(removeStoredBundle()).resolves.toBeUndefined()
  })
})

describe('BundleError', () => {
  it('carries the reason as a value the UI can translate', () => {
    const error = new BundleError('checksum-mismatch')
    expect(error.reason).toBe('checksum-mismatch')
    expect(error).toBeInstanceOf(Error)
  })
})

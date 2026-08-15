/**
 * Getting 528 MB of weights onto the device, and keeping them there.
 *
 * DIA-97. The engine landed in DIA-96 able to run a bundle and with no way to
 * obtain one: `init()` failed with `model-unavailable` on every machine that had
 * not been handed a file by hand. This module is the missing half.
 *
 * ## Why the file arrives through a file picker
 *
 * The ticket says "download from the devops-interview-app releases", and a
 * browser cannot. GitHub serves release assets without
 * `Access-Control-Allow-Origin` — see the note on `MODEL_RELEASE_URL` for the
 * two hops and what each one answered — so `fetch()` from our origin fails
 * before a byte arrives. This is not a CSP setting we forgot to add: a policy
 * can forbid a request, never permit one the server declines to answer.
 *
 * Everything reachable from there was worse. Mirroring onto our own origin runs
 * into GitHub Pages' 100 MB-per-file cap. Hugging Face does send CORS, but the
 * Gemma repositories are gated and answer 401 without a token — an account, on
 * a product whose selling point is that it needs none. A proxy means a server,
 * which is the one thing this app does not have.
 *
 * So the person downloads the file the ordinary way and points us at it. One
 * extra step, honestly explained, in exchange for the integrity check that
 * matters more than the convenience: `MODEL_SHA256` is verified either way.
 *
 * ## Why OPFS and not the Cache API
 *
 * The Cache API stores a `Response`, and building one means having the bytes —
 * all 554,661,246 of them — as chunks in JS memory before the copy to disk
 * begins. Peak use is roughly twice the file. The origin private file system
 * takes a `ReadableStream` chunk by chunk and never holds more than one, which
 * is why the import below runs in a few megabytes on a phone.
 *
 * Availability is not a trade: OPFS shipped in Chrome 108, Safari 15.2 and
 * Firefox 111, all of them before those browsers had WebGPU — and without
 * WebGPU MediaPipe's runtime does not start at all. Every browser that can use
 * this file can store it, the same argument `genaiFileset.ts` makes about SIMD.
 */

import { Sha256Stream } from '../../shared/lib/sha256'
import { MODEL_FILE_NAME, MODEL_SHA256, MODEL_SIZE_BYTES } from './modelConfig'

/** Bumped when a stored bundle stops being usable for reasons other than its digest. */
const CACHE_VERSION = 1
const META_FILE_NAME = 'bundle.meta.json'

export interface BundleProgress {
  receivedBytes: number
  /** 0 when the source did not say — a URL with no Content-Length. */
  totalBytes: number
  /** Averaged over the last few seconds, not over the whole run: a stall should show as one. */
  bytesPerSecond: number
}

export type BundleFailure =
  /** No origin private file system — a browser that cannot run the engine either. */
  | 'no-storage'
  /** The device does not have room, asked before the first byte rather than after the last. */
  | 'insufficient-space'
  /** Right file name, wrong bytes. */
  | 'checksum-mismatch'
  /** Not the release asset at all — usually an HTML error page saved as .task. */
  | 'wrong-size'
  | 'network-error'
  | 'cancelled'
  | 'storage-error'

export class BundleError extends Error {
  readonly reason: BundleFailure

  constructor(reason: BundleFailure, cause?: unknown) {
    super(`model bundle: ${reason}`, { cause })
    this.name = 'BundleError'
    this.reason = reason
  }
}

interface BundleMeta {
  version: number
  file: string
  sizeBytes: number
  sha256: string
  storedAt: string
}

export interface StoredBundle {
  /** A `blob:` URL for MediaPipe's `modelAssetPath`. Release it with `releaseBundleUrl`. */
  url: string
  sizeBytes: number
  storedAt: string
}

/** What a stream of bytes can come from. Both paths verify the same digest. */
export type BundleSource = { kind: 'file'; file: Blob } | { kind: 'url'; url: string }

export interface ImportOptions {
  onProgress?: (progress: BundleProgress) => void
  signal?: AbortSignal
}

function opfsRoot(): Promise<FileSystemDirectoryHandle> {
  // Feature-detected rather than assumed: Firefox in private browsing exposes
  // `navigator.storage` and throws on getDirectory().
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    return Promise.reject(new BundleError('no-storage'))
  }
  return navigator.storage.getDirectory().catch((error) => {
    throw new BundleError('no-storage', error)
  })
}

/** Whether this browser can store a bundle at all — asked before any UI offers to. */
export function isBundleStorageAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
}

/**
 * The bundle already on this device, or null.
 *
 * The digest is *not* recomputed here, and that is deliberate: it was verified
 * when the file was written, and re-reading 528 MB on every page load to prove
 * it again would cost seconds on a phone for a file only this origin can write.
 * What is re-checked is cheap and catches the realistic failure — a write cut
 * short by a closed tab leaves a short file and a missing meta record.
 */
export async function readStoredBundle(): Promise<StoredBundle | null> {
  const found = await openStoredBundle()
  if (!found) return null

  return { url: URL.createObjectURL(found.file), sizeBytes: found.file.size, storedAt: found.meta.storedAt }
}

/**
 * The same check without minting an object URL.
 *
 * For callers that only want to know whether the bundle is there — a screen
 * reporting on it, rather than an engine about to load it. An unreleased object
 * URL pins the whole 528 MB for the life of the document, so the version that
 * does not create one is the version a render path should use.
 */
export async function statStoredBundle(): Promise<{ sizeBytes: number; storedAt: string } | null> {
  const found = await openStoredBundle()
  return found && { sizeBytes: found.file.size, storedAt: found.meta.storedAt }
}

async function openStoredBundle(): Promise<{ file: File; meta: BundleMeta } | null> {
  let root: FileSystemDirectoryHandle
  try {
    root = await opfsRoot()
  } catch {
    return null
  }

  try {
    const meta = await readMeta(root)
    if (!meta) return null
    if (meta.version !== CACHE_VERSION || meta.sha256 !== MODEL_SHA256 || meta.file !== MODEL_FILE_NAME) {
      // A different model, or a format this build no longer understands. Drop it
      // rather than leave half a gigabyte of dead weight on someone's disk.
      await removeStoredBundle()
      return null
    }

    const file = await (await root.getFileHandle(MODEL_FILE_NAME)).getFile()
    if (file.size !== meta.sizeBytes) {
      await removeStoredBundle()
      return null
    }

    return { file, meta }
  } catch {
    return null
  }
}

/** Revokes an object URL from `readStoredBundle`/`importBundle`. Leaks the file otherwise. */
export function releaseBundleUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export async function removeStoredBundle(): Promise<void> {
  try {
    const root = await opfsRoot()
    await root.removeEntry(MODEL_FILE_NAME).catch(() => {})
    await root.removeEntry(META_FILE_NAME).catch(() => {})
  } catch {
    // Nothing stored, or no storage at all. Either way there is nothing to undo.
  }
}

export interface StorageHeadroom {
  quotaBytes: number
  usageBytes: number
  freeBytes: number
  /** False when the bundle plus a 5% margin would not fit. */
  sufficient: boolean
}

/**
 * Whether there is room, asked before the download rather than discovered at 94%.
 *
 * `estimate()` reports the origin's quota, which browsers derive from free disk
 * space; both numbers are deliberately imprecise for fingerprinting reasons, so
 * this is a guard against the obvious no, not a guarantee of yes.
 */
export async function checkStorageHeadroom(): Promise<StorageHeadroom> {
  const estimate = (await navigator.storage?.estimate?.()) ?? {}
  const quotaBytes = estimate.quota ?? 0
  const usageBytes = estimate.usage ?? 0
  const freeBytes = Math.max(quotaBytes - usageBytes, 0)

  // Unknown quota is treated as enough: some browsers report nothing, and
  // refusing to try on that basis would block devices that would have worked.
  const sufficient = quotaBytes === 0 || freeBytes >= MODEL_SIZE_BYTES * 1.05
  return { quotaBytes, usageBytes, freeBytes, sufficient }
}

/**
 * Streams `source` into storage, hashing as it goes, and keeps it only if the
 * digest matches.
 *
 * The order is the point. Bytes are written and hashed in one pass, so nothing
 * is buffered; the digest is compared *before* the meta record is written, so a
 * file that fails verification is never visible to `readStoredBundle` — and it
 * is deleted rather than left to occupy the disk of someone who then has to
 * find it.
 */
export async function importBundle(source: BundleSource, options: ImportOptions = {}): Promise<StoredBundle> {
  const { onProgress, signal } = options

  const headroom = await checkStorageHeadroom()
  if (!headroom.sufficient) throw new BundleError('insufficient-space')

  const root = await opfsRoot()

  // Best effort, and it matters: without this the browser is free to evict half
  // a gigabyte the candidate spent ten minutes fetching, under storage pressure
  // caused by something else entirely.
  await navigator.storage?.persist?.().catch(() => false)

  // The meta record goes first, so an interrupted write cannot be mistaken for a
  // finished one — an incomplete file with a valid record is the one failure
  // this module must never produce.
  await root.removeEntry(META_FILE_NAME).catch(() => {})

  const { stream, totalBytes } = await openSource(source, signal)

  let handle: FileSystemFileHandle
  let writable: FileSystemWritableFileStream
  try {
    handle = await root.getFileHandle(MODEL_FILE_NAME, { create: true })
    // Truncates: a previous partial write is overwritten, not appended to.
    writable = await handle.createWritable()
  } catch (error) {
    throw new BundleError('storage-error', error)
  }

  const digest = new Sha256Stream()
  const speed = new SpeedMeter()
  let receivedBytes = 0

  try {
    const reader = stream.getReader()
    for (;;) {
      if (signal?.aborted) throw new BundleError('cancelled')

      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      const chunk: Uint8Array<ArrayBuffer> = value instanceof Uint8Array ? value : new Uint8Array(value)
      digest.update(chunk)
      await writable.write(chunk)

      receivedBytes += chunk.length
      onProgress?.({ receivedBytes, totalBytes, bytesPerSecond: speed.record(receivedBytes) })
    }
    await writable.close()
  } catch (error) {
    await writable.abort().catch(() => {})
    await removeStoredBundle()

    if (error instanceof BundleError) throw error
    if (signal?.aborted || (error as Error)?.name === 'AbortError') throw new BundleError('cancelled')
    throw new BundleError(source.kind === 'url' ? 'network-error' : 'storage-error', error)
  }

  if (receivedBytes !== MODEL_SIZE_BYTES) {
    await removeStoredBundle()
    throw new BundleError('wrong-size')
  }
  if (digest.digestHex() !== MODEL_SHA256) {
    await removeStoredBundle()
    throw new BundleError('checksum-mismatch')
  }

  const meta: BundleMeta = {
    version: CACHE_VERSION,
    file: MODEL_FILE_NAME,
    sizeBytes: receivedBytes,
    sha256: MODEL_SHA256,
    storedAt: new Date().toISOString(),
  }
  await writeMeta(root, meta)

  const file = await handle.getFile()
  return { url: URL.createObjectURL(file), sizeBytes: file.size, storedAt: meta.storedAt }
}

/** The file-picker path: the candidate downloaded the release asset themselves. */
export function importBundleFromFile(file: Blob, options?: ImportOptions): Promise<StoredBundle> {
  return importBundle({ kind: 'file', file }, options)
}

async function openSource(
  source: BundleSource,
  signal?: AbortSignal,
): Promise<{ stream: ReadableStream<Uint8Array<ArrayBuffer>>; totalBytes: number }> {
  if (source.kind === 'file') {
    return { stream: source.file.stream() as ReadableStream<Uint8Array<ArrayBuffer>>, totalBytes: source.file.size }
  }

  let response: Response
  try {
    response = await fetch(source.url, { signal })
  } catch (error) {
    if (signal?.aborted) throw new BundleError('cancelled')
    throw new BundleError('network-error', error)
  }

  // The same trap `isModelBundlePresent` documents: a static host with an SPA
  // fallback answers a missing path with 200 and a page of HTML, and we would
  // dutifully store half a kilobyte of markup as a language model.
  if (!response.ok || !response.body) throw new BundleError('network-error')
  if ((response.headers.get('content-type') ?? '').includes('text/html')) throw new BundleError('wrong-size')

  return {
    stream: response.body as ReadableStream<Uint8Array<ArrayBuffer>>,
    totalBytes: Number(response.headers.get('content-length') ?? 0),
  }
}

async function readMeta(root: FileSystemDirectoryHandle): Promise<BundleMeta | null> {
  try {
    const file = await (await root.getFileHandle(META_FILE_NAME)).getFile()
    return JSON.parse(await file.text()) as BundleMeta
  } catch {
    return null
  }
}

async function writeMeta(root: FileSystemDirectoryHandle, meta: BundleMeta): Promise<void> {
  const handle = await root.getFileHandle(META_FILE_NAME, { create: true })
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(meta))
  await writable.close()
}

/**
 * Throughput over a trailing window.
 *
 * An average over the whole run would keep showing 8 MB/s for a minute after the
 * connection died, which is precisely when someone is staring at the number
 * deciding whether to cancel.
 */
class SpeedMeter {
  private readonly samples: { at: number; bytes: number }[] = []
  private static readonly WINDOW_MS = 3000

  record(totalBytes: number): number {
    const at = Date.now()
    this.samples.push({ at, bytes: totalBytes })

    while (this.samples.length > 2 && at - this.samples[0].at > SpeedMeter.WINDOW_MS) this.samples.shift()

    const first = this.samples[0]
    const elapsed = (at - first.at) / 1000
    return elapsed > 0 ? Math.round((totalBytes - first.bytes) / elapsed) : 0
  }
}

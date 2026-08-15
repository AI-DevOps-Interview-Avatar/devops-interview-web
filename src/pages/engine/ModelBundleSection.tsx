import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BundleError,
  importBundleFromFile,
  isBundleStorageAvailable,
  removeStoredBundle,
  statStoredBundle,
  type BundleFailure,
  type BundleProgress,
} from '../../api/llm/modelBundle'
import {
  MODEL_FILE_NAME,
  MODEL_RELEASE_TAG,
  MODEL_RELEASE_URL,
  MODEL_SIZE_BYTES,
  isModelBundlePresent,
} from '../../api/llm/modelConfig'

/**
 * Putting the weights on this device (DIA-97).
 *
 * The shape of this is dictated by something outside the app: GitHub serves
 * release assets with no `Access-Control-Allow-Origin`, so the browser cannot
 * fetch them from our origin, and no amount of UI changes that. The candidate
 * downloads the file through the link and hands it back through a picker. The
 * text says so plainly rather than presenting a "Download" button that would
 * fail for a reason nobody could be expected to guess.
 *
 * DIA-98 turned it from a mechanism into a path. What was missing was never the
 * progress bar — it was that nobody arrived here: `/engine` was a diagnostics
 * page reachable only by someone who already knew to look. The invitation now
 * comes to the candidate on the selection screen (`LocalModelInvite`), this
 * section leads with what the model buys rather than what it costs, and a
 * finished import ends in a link back to an interview instead of a stored-file
 * receipt.
 */

type BundleState =
  | { status: 'checking' }
  /** Verified and stored on this device. */
  | { status: 'stored'; sizeBytes: number; storedAt: string }
  /** Served from `public/models/` — the development path. */
  | { status: 'served' }
  | { status: 'absent' }

type ImportState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: BundleProgress }
  /** Bytes are in, digest is being checked — the one part with no progress to report. */
  | { phase: 'verifying' }
  | { phase: 'failed'; reason: BundleFailure }

const MEGABYTE = 1024 * 1024

function megabytes(bytes: number): string {
  return (bytes / MEGABYTE).toFixed(0)
}

export function ModelBundleSection({ onBundleChange }: { onBundleChange?: () => void }) {
  const { t } = useTranslation()
  const [bundle, setBundle] = useState<BundleState>({ status: 'checking' })
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const probe = useCallback(async (): Promise<BundleState> => {
    const stored = await statStoredBundle()
    if (stored) return { status: 'stored', ...stored }

    // Only asked when there is nothing stored: it is a network round trip, and
    // on a deployed site the answer is always no.
    return (await isModelBundlePresent()) ? { status: 'served' } : { status: 'absent' }
  }, [])

  const refresh = useCallback(() => probe().then(setBundle), [probe])

  useEffect(() => {
    void probe().then(setBundle)
  }, [probe])

  async function importFile(file: File) {
    const controller = new AbortController()
    abortRef.current = controller
    setImportState({ phase: 'running', progress: { receivedBytes: 0, totalBytes: file.size, bytesPerSecond: 0 } })

    try {
      const result = await importBundleFromFile(file, {
        signal: controller.signal,
        onProgress: (progress) => setImportState({ phase: 'running', progress }),
      })
      // The last chunk is written long before the digest is compared, and on a
      // 528 MB file that gap is seconds of a bar sitting at 100%.
      setImportState({ phase: 'verifying' })
      // The engine mints its own URL when it starts; holding this one would pin
      // the file for the life of the document for nothing.
      URL.revokeObjectURL(result.url)

      setImportState({ phase: 'idle' })
      await refresh()
      onBundleChange?.()
    } catch (error) {
      setImportState({
        phase: 'failed',
        reason: error instanceof BundleError ? error.reason : 'storage-error',
      })
    } finally {
      abortRef.current = null
      // Same file twice in a row fires no change event otherwise, which reads as
      // the picker being broken after a failed attempt.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function remove() {
    await removeStoredBundle()
    await refresh()
    onBundleChange?.()
  }

  const busy = importState.phase === 'running' || importState.phase === 'verifying'

  return (
    <section data-testid="bundle-section" style={{ margin: '0 0 1.5rem' }}>
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem' }}>{t('engine.bundleSource.title')}</h2>

      {bundle.status === 'stored' && (
        <div data-testid="bundle-stored">
          <p style={{ color: '#9ca3af', margin: '0 0 0.75rem' }}>
            {t('engine.bundleSource.stored', {
              size: megabytes(bundle.sizeBytes),
              date: new Date(bundle.storedAt).toLocaleDateString(),
            })}
          </p>
          {/* The way out of this screen. Someone who just spent minutes on a
              download came here to interview, not to admire a stored file. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Link
              to="/interview"
              data-testid="bundle-start-interview"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 'var(--tap-target)',
                padding: '0.4rem 1rem',
                borderRadius: 8,
                background: '#c084fc',
                color: '#1c1d23',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t('engine.bundleSource.startInterview')}
            </Link>
            <button data-testid="bundle-remove" onClick={() => void remove()}>
              {t('engine.bundleSource.remove')}
            </button>
          </div>
        </div>
      )}

      {bundle.status === 'served' && (
        <p style={{ color: '#9ca3af', margin: 0 }} data-testid="bundle-served">
          {t('engine.bundleSource.served')}
        </p>
      )}

      {bundle.status === 'absent' && !busy && (
        <div data-testid="bundle-absent">
          {/* What it buys, before what it costs. The paragraph below is an
              explanation of an obstacle, and leading with an obstacle reads as
              an apology for a feature nobody has been offered yet. */}
          <p style={{ color: '#d1d5db', margin: '0 0 0.5rem' }}>{t('engine.bundleSource.benefit')}</p>
          <p style={{ color: '#9ca3af', margin: '0 0 0.75rem' }}>
            {t('engine.bundleSource.why', { size: megabytes(MODEL_SIZE_BYTES) })}
          </p>

          <ol style={{ color: '#9ca3af', margin: '0 0 1rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            <li>
              <a href={MODEL_RELEASE_URL} rel="noreferrer noopener" data-testid="bundle-release-link">
                {t('engine.bundleSource.download', { file: MODEL_FILE_NAME, tag: MODEL_RELEASE_TAG })}
              </a>
            </li>
            <li>{t('engine.bundleSource.thenPick')}</li>
          </ol>

          {isBundleStorageAvailable() ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".task,.bin,application/octet-stream"
                data-testid="bundle-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importFile(file)
                }}
              />
            </label>
          ) : (
            <p style={{ color: '#f0b7b7', margin: 0 }}>{t('engine.bundleErrors.no-storage')}</p>
          )}
        </div>
      )}

      {importState.phase === 'running' && (
        <div data-testid="bundle-progress">
          <progress
            value={importState.progress.receivedBytes}
            max={importState.progress.totalBytes || MODEL_SIZE_BYTES}
            style={{ width: '100%', maxWidth: 420 }}
          />
          <p style={{ color: '#9ca3af', margin: '0.35rem 0 0.75rem' }}>
            {t('engine.bundleSource.progress', {
              percent: Math.floor(
                (importState.progress.receivedBytes / (importState.progress.totalBytes || MODEL_SIZE_BYTES)) * 100,
              ),
              received: megabytes(importState.progress.receivedBytes),
              total: megabytes(importState.progress.totalBytes || MODEL_SIZE_BYTES),
              speed: (importState.progress.bytesPerSecond / MEGABYTE).toFixed(1),
            })}
          </p>
          <button data-testid="bundle-cancel" onClick={() => abortRef.current?.abort()}>
            {t('engine.bundleSource.cancel')}
          </button>
        </div>
      )}

      {importState.phase === 'verifying' && (
        <p style={{ color: '#9ca3af', margin: 0 }} data-testid="bundle-verifying">
          {t('engine.bundleSource.verifying')}
        </p>
      )}

      {importState.phase === 'failed' && (
        <div data-testid="bundle-error">
          <p style={{ color: '#f0b7b7', margin: '0 0 0.75rem' }}>{t(`engine.bundleErrors.${importState.reason}`)}</p>
          <button onClick={() => setImportState({ phase: 'idle' })}>{t('engine.bundleSource.retry')}</button>
        </div>
      )}
    </section>
  )
}

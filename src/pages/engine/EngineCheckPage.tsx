import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import { detectEngineSupport, isSimdSupported, type EngineSupport } from '../../api/llm/capabilities'
import { MODEL_FILE_NAME, isModelBundlePresent } from '../../api/llm/modelConfig'
import { selectLlmBackend, type BackendSelection } from '../../api/llm/selectBackend'

/**
 * Whether this device can run the interviewer locally, and if not, which part
 * is missing.
 *
 * The engine landing without a screen would have been unverifiable: MediaPipe
 * needs WebGPU, WebGPU needs a GPU the browser has not blocklisted, and no unit
 * test can tell you whether the machine in front of you has one. This is the
 * page that answers it on real hardware — and the same three checks DIA-98's
 * bootstrap screen will run before it starts downloading half a gigabyte.
 */

type Probe = 'checking' | 'present' | 'absent'

const PROMPT = 'In one sentence: what does a CI pipeline do?'

export default function EngineCheckPage() {
  const { t } = useTranslation()
  const [support, setSupport] = useState<EngineSupport | null>(null)
  const [bundle, setBundle] = useState<Probe>('checking')
  const [selection, setSelection] = useState<BackendSelection | null>(null)
  const [answer, setAnswer] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    void detectEngineSupport().then(setSupport)

    // HEAD rather than GET: the answer is whether the bundle is there, and the
    // bundle is 528 MB.
    void isModelBundlePresent().then((present) => setBundle(present ? 'present' : 'absent'))
  }, [])

  async function runInference() {
    setRunning(true)
    setAnswer('')
    try {
      const chosen = await selectLlmBackend()
      setSelection(chosen)
      await chosen.backend.generate(PROMPT, (token) => setAnswer((previous) => previous + token))
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="page page--wide">
      <div className="page__chrome">
        <PageNav />
        <LanguageSwitcher />
      </div>

      <header className="page__header">
        <h1 style={{ margin: 0 }}>{t('engine.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('engine.subtitle')}</p>
      </header>

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: '0 0 1.5rem' }}>
        <Row label={t('engine.webgpu')} testId="probe-webgpu">
          {support === null
            ? t('engine.checking')
            : support.supported
              ? `✅ ${support.adapter ?? t('engine.yes')}`
              : `❌ ${t(`engine.reasons.${support.reason}`)}`}
        </Row>
        <Row label={t('engine.simd')} testId="probe-simd">
          {isSimdSupported() ? `✅ ${t('engine.yes')}` : `❌ ${t('engine.simdFallback')}`}
        </Row>
        <Row label={t('engine.bundle')} testId="probe-bundle">
          {bundle === 'checking'
            ? t('engine.checking')
            : bundle === 'present'
              ? `✅ ${MODEL_FILE_NAME}`
              : `❌ ${t('engine.reasons.model-unavailable')}`}
        </Row>
      </dl>

      <button data-testid="engine-run" onClick={() => void runInference()} disabled={running}>
        {running ? t('engine.running') : t('engine.run')}
      </button>

      {selection && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 data-testid="engine-verdict" data-kind={selection.kind}>
            {selection.kind === 'mediapipe' ? t('engine.verdict.onDevice') : t('engine.verdict.scripted')}
          </h2>
          {selection.fallbackReason && (
            <p style={{ color: '#9ca3af' }}>{t(`engine.reasons.${selection.fallbackReason}`)}</p>
          )}
          <p style={{ margin: '0.75rem 0 0', color: '#9ca3af', fontSize: 13 }}>{PROMPT}</p>
          <pre
            data-testid="engine-answer"
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              background: '#1c1d23',
              border: '1px solid #2e303a',
              borderRadius: 12,
              padding: 'clamp(0.75rem, 3vw, 1rem)',
              margin: '0.4rem 0 0',
              fontFamily: 'inherit',
              minHeight: '3rem',
            }}
          >
            {answer}
          </pre>
        </div>
      )}
    </main>
  )
}

function Row({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: '#9ca3af' }}>{label}</dt>
      <dd data-testid={testId} style={{ margin: 0, overflowWrap: 'anywhere' }}>
        {children}
      </dd>
    </>
  )
}

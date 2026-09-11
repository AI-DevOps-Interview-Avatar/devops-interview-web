import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { detectEngineSupport } from '../../api/llm/capabilities'
import { statStoredBundle } from '../../api/llm/modelBundle'
import { MODEL_SIZE_BYTES } from '../../api/llm/modelConfig'
import { STORAGE_PREFIX } from '../../store/localData'

const DISMISS_KEY = `${STORAGE_PREFIX}engine-invite-dismissed`

function wasDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(DISMISS_KEY) === '1'
}

/** The shared shell: one line of advice in the block under the privacy note. */
const NOTE_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '0.75rem',
  padding: '0.7rem 0.9rem',
  borderRadius: 12,
  border: '1px solid #2e303a',
  background: 'rgba(20, 25, 40, 0.55)',
  color: '#9ca3af',
  fontSize: 13,
  lineHeight: 1.45,
} as const

const ACTION_STYLE = {
  padding: '0.3rem 0.75rem',
  borderRadius: 999,
  border: '1px solid #383944',
  background: '#2a2b33',
  color: '#c084fc',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
} as const

/**
 * Everything this app has to say about running the interviewer on-device, in
 * one aside with two states.
 *
 * **The invitation** (DIA-98) tells a candidate whose machine can run the model
 * that it can. Everything needed to prepare the engine has existed since DIA-97
 * and lived on `/engine`, a screen reachable only by someone who already knew
 * to look for it. The weights are not something a person goes hunting for; the
 * offer has to arrive where they already are, which is the screen where they
 * pick an interviewer.
 *
 * Three conditions, all of them required, and the strictness is the point:
 *
 *   - **the device can actually run it** — `requestAdapter()`, not a guess. Most
 *     visitors have no WebGPU adapter, and inviting them to download half a
 *     gigabyte they cannot use would be worse than saying nothing;
 *   - **no bundle is stored yet** — otherwise this is an advert for something
 *     already done;
 *   - **it has not been waved away** — once dismissed it stays dismissed. The
 *     flag sits under the shared namespace, so "clear my data" resets it along
 *     with everything else, which is deliberate: the next person on a shared
 *     laptop is a first-time visitor.
 *
 * **The check** is what the other states collapse to, and it is why `/engine`
 * no longer needs a nav pill of its own (DIA-218). A diagnostic sitting between
 * "Job search resources" and "History" reads as a feature; the same link, one
 * line down in the advice block, reads as what it is — an answer to "will this
 * work on my machine?". It is also where someone who said "not now" finds the
 * offer again, instead of being told once and never again.
 */
export function EngineNote() {
  const { t } = useTranslation()

  // Starts on the check, not on nothing: the probe below takes a GPU round trip
  // and sometimes a 1.5s retry, and an aside that appears after the grid has
  // painted pushes the whole page down under it.
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (wasDismissed()) return

    let cancelled = false

    // Cheapest question first: a stored bundle means there is nothing to offer,
    // and answering it costs no GPU probe and no network.
    void statStoredBundle()
      .then(async (stored) => {
        if (stored) return false
        if ((await detectEngineSupport()).supported) return true

        // One retry, because the first answer can be a false no. Measured on a
        // cold browser profile: Chrome's GPU process is still starting while
        // this screen renders, `requestAdapter()` resolves to null, and the very
        // same machine reports an adapter a second later. This runs in the
        // background and blocks nothing, so it can afford to ask twice —
        // `/engine` deliberately does not, because a visitor who genuinely has
        // no adapter, which is most of them, should not wait to be told so.
        await new Promise((resolve) => setTimeout(resolve, 1500))
        return (await detectEngineSupport()).supported
      })
      .then((offer) => {
        if (!cancelled && offer) setInviting(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setInviting(false)
  }

  if (!inviting) {
    return (
      <aside data-testid="engine-check-note" style={NOTE_STYLE}>
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.2 }}>
          ⚙️
        </span>
        <p style={{ margin: 0, flex: '1 1 16rem' }}>{t('engine.check.body')}</p>
        <Link to="/engine" data-testid="engine-check-link" style={{ ...ACTION_STYLE, flexShrink: 0 }}>
          {t('engine.check.action')}
        </Link>
      </aside>
    )
  }

  return (
    <aside data-testid="engine-invite" style={NOTE_STYLE}>
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.2 }}>
        ⚡
      </span>
      <p style={{ margin: 0, flex: '1 1 16rem' }}>
        <strong style={{ color: '#e5e7eb', fontWeight: 600 }}>{t('engine.invite.title')}</strong>{' '}
        {t('engine.invite.body', { size: Math.round(MODEL_SIZE_BYTES / (1024 * 1024)) })}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <Link to="/engine" data-testid="engine-invite-prepare" style={ACTION_STYLE}>
          {t('engine.invite.prepare')}
        </Link>
        <button
          data-testid="engine-invite-dismiss"
          onClick={dismiss}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: 999,
            border: '1px solid #383944',
            background: 'transparent',
            color: '#9ca3af',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t('engine.invite.later')}
        </button>
      </div>
    </aside>
  )
}

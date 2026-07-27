import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RETENTION_DAYS, STORAGE_PREFIX } from '../../store/localData'

const ACK_KEY = `${STORAGE_PREFIX}privacy-ack`

function hasAcknowledged(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ACK_KEY) === '1'
}

interface PrivacyNoteProps {
  /**
   * First-run placement: the note can be dismissed and stays dismissed.
   * Omit on screens that show stored data, where the note is part of the
   * explanation rather than an announcement.
   */
  dismissible?: boolean
}

/**
 * Tells the candidate, before they type anything, where their answers go.
 *
 * The app never had this. It is a public site asking for salary expectations
 * and current employer, storing the replies on the device indefinitely, and
 * saying nothing about either — the fact that no server is involved is a real
 * privacy advantage, and it was invisible.
 *
 * The dismissal flag lives under the same namespace as everything else, so
 * "Clear my data" resets it too and the next person on a shared machine is
 * greeted as a first-time visitor. That is the intended behaviour, not an
 * oversight.
 */
export function PrivacyNote({ dismissible = false }: PrivacyNoteProps) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => dismissible && hasAcknowledged())

  if (dismissed) return null

  const acknowledge = () => {
    localStorage.setItem(ACK_KEY, '1')
    setDismissed(true)
  }

  return (
    <aside
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.7rem 0.9rem',
        borderRadius: 12,
        border: '1px solid #2e303a',
        background: 'rgba(20, 25, 40, 0.55)',
        color: '#9ca3af',
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.2 }}>
        🔒
      </span>
      <p style={{ margin: 0, flex: 1 }}>{t('privacy.note', { days: RETENTION_DAYS })}</p>
      {dismissible && (
        <button
          onClick={acknowledge}
          style={{
            flexShrink: 0,
            padding: '0.3rem 0.75rem',
            borderRadius: 999,
            border: '1px solid #383944',
            background: '#2a2b33',
            color: '#c084fc',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('privacy.dismiss')}
        </button>
      )}
    </aside>
  )
}

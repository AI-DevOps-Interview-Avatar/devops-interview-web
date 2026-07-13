import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MockLlmBackend } from '../../api/llmClient'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { addMessage, MAX_QUESTIONS, startInterview } from '../../store/interviewSlice'
import { appendHistory } from '../../store/historySlice'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import type { RootState } from '../../store'

export default function MeetSessionPage() {
  const { interviewerId } = useParams<{ interviewerId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation()
  const { messages, questionCount, finished } = useSelector((state: RootState) => state.interview)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [messagesOpen, setMessagesOpen] = useState(true)
  const backendRef = useRef(new MockLlmBackend())

  const interviewer = INTERVIEWERS.find((i) => i.id === interviewerId)

  useEffect(() => {
    if (!interviewerId) return
    dispatch(startInterview(interviewerId))
    backendRef.current.init().then(() => askNextQuestion())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId])

  useEffect(() => {
    if (finished) {
      appendHistory({
        interviewerId: interviewerId ?? 'unknown',
        finishedAt: new Date().toISOString(),
        questionCount,
      })
    }
  }, [finished, interviewerId, questionCount])

  async function askNextQuestion() {
    setStreaming('')
    const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'
    const full = await backendRef.current.generate('', lang, (token) =>
      setStreaming((prev) => prev + token),
    )
    dispatch(addMessage({ author: 'interviewer', text: full }))
    setStreaming('')
  }

  function handleSend() {
    if (!draft.trim()) return
    dispatch(addMessage({ author: 'user', text: draft.trim() }))
    setDraft('')
    if (questionCount < MAX_QUESTIONS) {
      askNextQuestion()
    }
  }

  if (!interviewer) {
    return <p>Interviewer not found.</p>
  }

  const caption = streaming || messages.at(-1)?.text || ''

  return (
    <main
      style={{
        position: 'relative',
        display: 'flex',
        height: '100vh',
        background: '#1c1d23',
        color: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      <section style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LanguageSwitcher />

        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <AvatarTile interviewer={interviewer} isSpeaking={Boolean(streaming)} size={320} />
            <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>{interviewer.voiceName}</p>
          </div>
        </div>

        {caption && (
          <p
            style={{
              position: 'absolute',
              bottom: 96,
              left: 24,
              right: messagesOpen ? 344 : 24,
              background: 'rgba(0,0,0,0.55)',
              padding: '0.5rem 1rem',
              borderRadius: 8,
            }}
          >
            {caption}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1.5rem' }}>
          <ControlButton label="mic" />
          <ControlButton label="camera" />
          <ControlButton label="chat" onClick={() => setMessagesOpen((v) => !v)} active={messagesOpen} />
          <ControlButton label="hangup" tone="#f44336" onClick={() => navigate('/interview')} />
        </div>

        {finished && (
          <div style={{ textAlign: 'center', paddingBottom: '1.5rem' }}>
            <p>{t('meet.finished')}</p>
            <button onClick={() => navigate('/history')}>{t('meet.viewHistory')}</button>
          </div>
        )}
      </section>

      {messagesOpen && (
        <aside
          style={{
            width: 320,
            background: '#111318',
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem',
            gap: '0.5rem',
          }}
        >
          <h2 style={{ fontSize: 16, margin: '0 0 0.5rem' }}>{t('meet.messagesTitle')}</h2>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.author === 'user' ? 'flex-end' : 'flex-start',
                  background: m.author === 'user' ? interviewer.color : '#2a2b33',
                  color: m.author === 'user' ? '#1c1d23' : '#f3f4f6',
                  borderRadius: 12,
                  padding: '0.5rem 0.75rem',
                  maxWidth: '85%',
                }}
              >
                {m.text}
              </div>
            ))}
            {streaming && (
              <div style={{ alignSelf: 'flex-start', background: '#2a2b33', borderRadius: 12, padding: '0.5rem 0.75rem' }}>
                {streaming}
              </div>
            )}
          </div>
          {!finished && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('meet.sendPlaceholder') ?? ''}
                style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid #383944', background: '#1c1d23', color: 'inherit' }}
              />
              <button onClick={handleSend}>{t('meet.send')}</button>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}

function ControlButton({
  label,
  tone = '#3a3b45',
  active,
  onClick,
}: {
  label: string
  tone?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        background: active ? '#c084fc' : tone,
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {label[0].toUpperCase()}
    </button>
  )
}

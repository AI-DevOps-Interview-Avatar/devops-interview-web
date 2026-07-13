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
import { SelfCameraTile } from '../../shared/ui/SelfCameraTile'
import { ChatIcon, CallEndIcon, MicIcon, VideocamIcon, VideocamOffIcon } from '../../shared/ui/icons'
import { speak, stopSpeaking } from '../../shared/voice/tts'
import { isSpeechRecognitionSupported, startListening, type ListeningHandle } from '../../shared/voice/stt'
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
  const [cameraOn, setCameraOn] = useState(false)
  const [listening, setListening] = useState(false)
  const backendRef = useRef(new MockLlmBackend())
  const listeningHandleRef = useRef<ListeningHandle | null>(null)

  const interviewer = INTERVIEWERS.find((i) => i.id === interviewerId)
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'
  const turns = t('meet.turns', { returnObjects: true }) as string[]

  useEffect(() => {
    if (!interviewerId) return
    dispatch(startInterview(interviewerId))
    backendRef.current.init().then(() => askNextQuestion(0))
    return () => stopSpeaking()
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

  async function askNextQuestion(turnIndex: number) {
    setStreaming('')
    const text = turns[turnIndex % turns.length]
    const full = await backendRef.current.generate(text, (token) =>
      setStreaming((prev) => prev + token),
    )
    dispatch(addMessage({ author: 'interviewer', turnIndex }))
    setStreaming('')
    speak(full, lang)
  }

  function handleSend() {
    if (!draft.trim()) return
    dispatch(addMessage({ author: 'user', text: draft.trim() }))
    setDraft('')
    if (questionCount < MAX_QUESTIONS) {
      askNextQuestion(questionCount)
    }
  }

  function toggleListening() {
    if (listening) {
      listeningHandleRef.current?.stop()
      return
    }
    stopSpeaking()
    const handle = startListening(
      lang,
      (transcript) => setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript)),
      () => {
        setListening(false)
        listeningHandleRef.current = null
      },
    )
    if (handle) {
      listeningHandleRef.current = handle
      setListening(true)
    }
  }

  if (!interviewer) {
    return <p>Interviewer not found.</p>
  }

  const lastInterviewerMessage = [...messages].reverse().find((m) => m.author === 'interviewer')
  const caption =
    streaming || (lastInterviewerMessage?.author === 'interviewer' ? turns[lastInterviewerMessage.turnIndex] : '')

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

        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div
            style={{
              position: 'relative',
              width: 'min(70vh, 560px)',
              aspectRatio: '1 / 1',
              background: '#111318',
              border: '1px solid #2e303a',
              borderRadius: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              overflow: 'hidden',
            }}
          >
            <AvatarTile interviewer={interviewer} isSpeaking={Boolean(streaming)} size={220} />
            <p style={{ fontWeight: 600 }}>{interviewer.voiceName}</p>

            {caption && (
              <p
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  right: 16,
                  background: 'rgba(0,0,0,0.55)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                {caption}
              </p>
            )}

            <SelfCameraTile active={cameraOn} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1.5rem' }}>
          <ControlButton
            label={listening ? t('meet.controls.micStop') : t('meet.controls.micStart')}
            onClick={toggleListening}
            active={listening}
            disabled={!isSpeechRecognitionSupported()}
            title={isSpeechRecognitionSupported() ? undefined : t('meet.controls.micUnsupported')}
          >
            <MicIcon />
          </ControlButton>
          <ControlButton
            label={cameraOn ? t('meet.controls.cameraOn') : t('meet.controls.cameraOff')}
            onClick={() => setCameraOn((v) => !v)}
            active={cameraOn}
          >
            {cameraOn ? <VideocamIcon /> : <VideocamOffIcon />}
          </ControlButton>
          <ControlButton
            label={t('meet.controls.chat')}
            onClick={() => setMessagesOpen((v) => !v)}
            active={messagesOpen}
          >
            <ChatIcon />
          </ControlButton>
          <ControlButton label={t('meet.controls.hangup')} tone="#f44336" onClick={() => navigate('/interview')}>
            <CallEndIcon />
          </ControlButton>
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
                {m.author === 'user' ? m.text : turns[m.turnIndex]}
              </div>
            ))}
            {streaming && (
              <div style={{ alignSelf: 'flex-start', background: '#2a2b33', borderRadius: 12, padding: '0.5rem 0.75rem' }}>
                {streaming}
              </div>
            )}
            {listening && (
              <div style={{ alignSelf: 'center', color: '#9ca3af', fontSize: 13 }}>{t('meet.controls.listening')}</div>
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
  disabled,
  title,
  onClick,
  children,
}: {
  label: string
  tone?: string
  active?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        background: active ? '#c084fc' : tone,
        color: active ? '#1c1d23' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

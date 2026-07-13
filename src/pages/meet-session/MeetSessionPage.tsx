import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MockLlmBackend } from '../../api/llmClient'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { QUESTION_BANKS } from '../../domain/models/questionBank'
import { assessSession } from '../../domain/assessment'
import { addMessage, MAX_QUESTIONS, startInterview } from '../../store/interviewSlice'
import { appendHistory } from '../../store/historySlice'
import { shuffle } from '../../shared/lib/shuffle'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { SelfCameraTile } from '../../shared/ui/SelfCameraTile'
import {
  CallEndIcon,
  CaptionsIcon,
  ChatIcon,
  InfoIcon,
  MicIcon,
  MoreVertIcon,
  PeopleIcon,
  PresentIcon,
  VideocamIcon,
  VideocamOffIcon,
} from '../../shared/ui/icons'
import { speak, stopSpeaking } from '../../shared/voice/tts'
import { isSpeechRecognitionSupported, startListening, type ListeningHandle } from '../../shared/voice/stt'
import type { RootState } from '../../store'

export default function MeetSessionPage() {
  const { interviewerId } = useParams<{ interviewerId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation()
  const { messages, selectedQuestions, questionCount, finished } = useSelector((state: RootState) => state.interview)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [messagesOpen, setMessagesOpen] = useState(true)
  const [cameraOn, setCameraOn] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [listening, setListening] = useState(false)
  const backendRef = useRef(new MockLlmBackend())
  const listeningHandleRef = useRef<ListeningHandle | null>(null)
  const historySavedRef = useRef(false)

  const interviewer = INTERVIEWERS.find((i) => i.id === interviewerId)
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'

  useEffect(() => {
    if (!interviewerId) return
    // Guards against React StrictMode's dev-only double-invoke of this effect
    // (mount → cleanup → mount), which would otherwise fire two overlapping
    // askNextQuestion(0, ...) calls and duplicate the first question.
    let cancelled = false
    const bank = QUESTION_BANKS[interviewerId] ?? []
    const questions = shuffle(bank).slice(0, MAX_QUESTIONS)
    historySavedRef.current = false
    dispatch(startInterview({ interviewerId, questions }))

    async function run() {
      await backendRef.current.init()
      if (cancelled) return
      const profile = INTERVIEWERS.find((i) => i.id === interviewerId)
      if (profile) {
        setStreaming('')
        const greetingText = t(`interviewers.${interviewerId}.greeting`, { name: profile.voiceName })
        const full = await backendRef.current.generate(greetingText, (token) => setStreaming((prev) => prev + token))
        if (cancelled) return
        dispatch(addMessage({ author: 'interviewer', greeting: true }))
        setStreaming('')
        await new Promise<void>((resolve) => speak(full, lang, profile.voiceGender, resolve))
        if (cancelled) return
      }
      askNextQuestion(0, questions)
    }
    run()

    return () => {
      cancelled = true
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId])

  useEffect(() => {
    if (finished) {
      saveToHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  function saveToHistory() {
    if (historySavedRef.current || !interviewerId || selectedQuestions.length === 0) return
    historySavedRef.current = true
    const assessment = assessSession(messages, selectedQuestions)
    appendHistory({
      interviewerId,
      level: selectedQuestions[0].level,
      finishedAt: new Date().toISOString(),
      ...assessment,
    })
  }

  async function askNextQuestion(questionIndex: number, questions = selectedQuestions) {
    const question = questions[questionIndex]
    if (!question) return
    setStreaming('')
    const text = question[lang]
    const full = await backendRef.current.generate(text, (token) => setStreaming((prev) => prev + token))
    dispatch(addMessage({ author: 'interviewer', questionIndex }))
    setStreaming('')
    if (interviewer) {
      speak(full, lang, interviewer.voiceGender)
    }
  }

  function sendMessage(text: string) {
    if (!text.trim()) return
    dispatch(addMessage({ author: 'user', text: text.trim() }))
    setDraft('')
    if (questionCount < MAX_QUESTIONS) {
      askNextQuestion(questionCount)
    }
  }

  function handleSend() {
    sendMessage(draft)
  }

  function handleHangup() {
    saveToHistory()
    navigate('/interview')
  }

  function toggleListening() {
    if (listening) {
      listeningHandleRef.current?.stop()
      return
    }
    stopSpeaking()
    const handle = startListening(
      lang,
      (transcript) => {
        // Voice answers are one-shot (interimResults=false): the moment we
        // get a final transcript, send it — don't leave it sitting in the
        // input box waiting for a manual "Send" click.
        const combined = draft ? `${draft} ${transcript}` : transcript
        sendMessage(combined)
      },
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

  const assessment = useMemo(
    () => (finished ? assessSession(messages, selectedQuestions) : null),
    [finished, messages, selectedQuestions],
  )

  if (!interviewer) {
    return <p>Interviewer not found.</p>
  }

  const voiceName = interviewer.voiceName
  function interviewerMessageText(m: { author: 'interviewer'; questionIndex: number } | { author: 'interviewer'; greeting: true }) {
    return 'questionIndex' in m
      ? selectedQuestions[m.questionIndex]?.[lang]
      : t(`interviewers.${interviewerId}.greeting`, { name: voiceName })
  }

  const lastInterviewerMessage = [...messages].reverse().find((m) => m.author === 'interviewer')
  const caption =
    streaming ||
    (lastInterviewerMessage?.author === 'interviewer' ? interviewerMessageText(lastInterviewerMessage) : '')

  return (
    <main
      style={{
        position: 'relative',
        display: 'flex',
        height: '100vh',
        background: '#0e0e11',
        color: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      <section style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <LanguageSwitcher />

        {/* Full-bleed video tile, Meet-style — no card border/padding around it. */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            background: 'radial-gradient(ellipse at center, #2a2b33 0%, #16171a 75%)',
            overflow: 'hidden',
          }}
        >
          {finished && assessment ? (
            <AssessmentCard
              assessment={assessment}
              interviewerRole={interviewer.role}
              onViewHistory={() => navigate('/history')}
            />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <AvatarTile interviewer={interviewer} isSpeaking={Boolean(streaming)} size={280} />
              <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>{interviewer.voiceName}</p>
            </div>
          )}

          {!finished && captionsOn && caption && (
            <p
              style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                right: 24,
                textAlign: 'center',
                background: 'rgba(0,0,0,0.6)',
                padding: '0.6rem 1rem',
                borderRadius: 8,
                fontSize: 15,
              }}
            >
              {caption}
            </p>
          )}

          {!finished && <SelfCameraTile active={cameraOn} />}
        </div>

        {/* Meet toolbar: grouped pills — mic/camera/captions/present/more, hangup, info/people/chat. */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '0.75rem 1rem',
            background: '#202124',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', background: '#2a2b2f', borderRadius: 999, padding: 6 }}>
            <ControlButton
              label={listening ? t('meet.controls.micStop') : t('meet.controls.micStart')}
              onClick={toggleListening}
              active={listening}
              disabled={!isSpeechRecognitionSupported() || finished}
              title={isSpeechRecognitionSupported() ? undefined : t('meet.controls.micUnsupported')}
            >
              <MicIcon />
            </ControlButton>
            <ControlButton
              label={cameraOn ? t('meet.controls.cameraOn') : t('meet.controls.cameraOff')}
              onClick={() => setCameraOn((v) => !v)}
              active={cameraOn}
              disabled={finished}
            >
              {cameraOn ? <VideocamIcon /> : <VideocamOffIcon />}
            </ControlButton>
            <ControlButton
              label={t('meet.controls.captions')}
              onClick={() => setCaptionsOn((v) => !v)}
              active={captionsOn}
              disabled={finished}
            >
              <CaptionsIcon />
            </ControlButton>
            <ControlButton label={t('meet.controls.notAvailable')} disabled>
              <PresentIcon />
            </ControlButton>
            <ControlButton label={t('meet.controls.notAvailable')} disabled>
              <MoreVertIcon />
            </ControlButton>
          </div>

          <ControlButton label={t('meet.controls.hangup')} tone="#f44336" wide onClick={handleHangup}>
            <CallEndIcon />
          </ControlButton>

          <div style={{ display: 'flex', gap: '0.5rem', background: '#2a2b2f', borderRadius: 999, padding: 6 }}>
            <ControlButton label={t('meet.controls.notAvailable')} disabled>
              <InfoIcon />
            </ControlButton>
            <ControlButton label={t('meet.controls.notAvailable')} disabled>
              <PeopleIcon />
            </ControlButton>
            <ControlButton
              label={t('meet.controls.chat')}
              onClick={() => setMessagesOpen((v) => !v)}
              active={messagesOpen}
            >
              <ChatIcon />
            </ControlButton>
          </div>
        </footer>
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
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.author === 'user' ? m.text : interviewerMessageText(m)}
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

function AssessmentCard({
  assessment,
  interviewerRole,
  onViewHistory,
}: {
  assessment: ReturnType<typeof assessSession>
  interviewerRole: string
  onViewHistory: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        background: '#1c1d23',
        border: '1px solid #2e303a',
        borderRadius: 16,
        padding: '1.5rem',
        width: 'min(90%, 420px)',
        textAlign: 'left',
      }}
    >
      <h2 style={{ marginTop: 0 }}>{t('meet.assessment.title', { role: interviewerRole })}</h2>
      <p style={{ color: '#9ca3af', fontSize: 13 }}>{t('meet.assessment.disclaimer')}</p>

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, margin: '1rem 0' }}>
        <dt>{t('meet.assessment.completion')}</dt>
        <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{assessment.completionRate}%</dd>
        <dt>{t('meet.assessment.avgAnswerWords')}</dt>
        <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{assessment.avgAnswerWords}</dd>
        <dt>{t('meet.assessment.categories')}</dt>
        <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{assessment.categories.join(', ') || '—'}</dd>
      </dl>

      <button onClick={onViewHistory} style={{ width: '100%' }}>
        {t('meet.viewHistory')}
      </button>
    </div>
  )
}

function ControlButton({
  label,
  tone = '#3c4043',
  active,
  disabled,
  wide,
  title,
  onClick,
  children,
}: {
  label: string
  tone?: string
  active?: boolean
  disabled?: boolean
  wide?: boolean
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
        width: wide ? 72 : 44,
        height: 44,
        borderRadius: wide ? 22 : '50%',
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        background: active ? '#c084fc' : tone,
        color: active ? '#1c1d23' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  )
}

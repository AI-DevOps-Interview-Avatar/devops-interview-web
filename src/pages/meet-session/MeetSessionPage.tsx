import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MockLlmBackend } from '../../api/llmClient'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { QUESTION_BANKS, PIPELINE_QUESTION_SETS } from '../../domain/models/questionBank'
import { STAGE3_REFERENCE_SOLUTIONS } from '../../domain/models/stage3Tasks'
import { assessSession } from '../../domain/assessment'
import { canEnterStage, OFFER_STAGE_INDEX, PIPELINE_STAGES } from '../../domain/pipeline'
import { addMessage, MAX_QUESTIONS, startInterview } from '../../store/interviewSlice'
import { completeStage } from '../../store/pipelineSlice'
import { appendHistory } from '../../store/historySlice'
import { shuffle } from '../../shared/lib/shuffle'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
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
  const params = useParams<{ interviewerId?: string; stageIndex?: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation()
  const { messages, selectedQuestions, questionCount, finished } = useSelector((state: RootState) => state.interview)
  const { completedStages } = useSelector((state: RootState) => state.pipeline)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  // Chat defaults open on tablet/desktop (inline column, matches the original Meet-style
  // layout) but closed on mobile, where it's a full-screen drawer that would otherwise
  // cover the interviewer's video the instant the page loads.
  const [messagesOpen, setMessagesOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  const [cameraOn, setCameraOn] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [listening, setListening] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const backendRef = useRef(new MockLlmBackend())
  const listeningHandleRef = useRef<ListeningHandle | null>(null)
  const historySavedRef = useRef(false)
  const stageCompletedRef = useRef(false)
  const askingRef = useRef(false)

  const parsedStageIndex = params.stageIndex !== undefined ? Number(params.stageIndex) : NaN
  const pipelineMode = !Number.isNaN(parsedStageIndex)
  const pipelineStageIndex = pipelineMode ? parsedStageIndex : null
  const interviewerId = pipelineMode ? (PIPELINE_STAGES[parsedStageIndex]?.interviewerId ?? undefined) : params.interviewerId

  const interviewer = INTERVIEWERS.find((i) => i.id === interviewerId)
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'

  // Sequential state-machine guard: a pipeline stage is only reachable once
  // every prior stage is completed — deep-linking straight to Stage 3 while
  // Stage 1/2 are unfinished bounces back to the pipeline overview.
  useEffect(() => {
    if (!pipelineMode) return
    if (pipelineStageIndex === null || pipelineStageIndex >= OFFER_STAGE_INDEX || !canEnterStage(completedStages, pipelineStageIndex)) {
      navigate('/pipeline')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineMode, pipelineStageIndex])

  useEffect(() => {
    if (!interviewerId) return
    if (pipelineMode && (pipelineStageIndex === null || !canEnterStage(completedStages, pipelineStageIndex))) return
    // Guards against React StrictMode's dev-only double-invoke of this effect
    // (mount → cleanup → mount), which would otherwise fire two overlapping
    // askNextQuestion(0, ...) calls and duplicate the first question.
    let cancelled = false
    const questions = pipelineMode
      ? (PIPELINE_QUESTION_SETS[interviewerId] ?? [])
      : shuffle(QUESTION_BANKS[interviewerId] ?? []).slice(0, MAX_QUESTIONS)
    historySavedRef.current = false
    stageCompletedRef.current = false
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
      if (pipelineMode && pipelineStageIndex !== null && !stageCompletedRef.current) {
        stageCompletedRef.current = true
        dispatch(completeStage({ stageIndex: pipelineStageIndex, selectedQuestions, messages }))
      }
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
    // Synchronous ref lock (not state) so a fast double-Enter can't slip
    // through the async gap between dispatching Q(n) and React committing
    // the resulting questionCount — which would otherwise re-ask Q(n).
    askingRef.current = true
    setStreaming('')
    const text = question[lang]
    const full = await backendRef.current.generate(text, (token) => setStreaming((prev) => prev + token))
    dispatch(addMessage({ author: 'interviewer', questionIndex }))
    setStreaming('')
    askingRef.current = false
    if (interviewer) {
      speak(full, lang, interviewer.voiceGender)
    }
  }

  function sendMessage(text: string) {
    if (!text.trim() || askingRef.current) return
    dispatch(addMessage({ author: 'user', text: text.trim() }))
    setDraft('')
    if (questionCount < selectedQuestions.length) {
      askNextQuestion(questionCount)
    }
  }

  function handleSend() {
    sendMessage(draft)
  }

  function handleHangup() {
    saveToHistory()
    navigate(pipelineMode ? '/pipeline' : '/interview')
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
    <main className="meet-shell">
      <section className="meet-main">
        <LanguageSwitcher />
        <PageNav onBeforeNavigate={saveToHistory} />

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
              pipelineCta={
                pipelineMode && pipelineStageIndex !== null
                  ? {
                      label:
                        pipelineStageIndex + 1 === OFFER_STAGE_INDEX
                          ? t('pipeline.viewOffer')
                          : t('pipeline.continueTo', { title: t(PIPELINE_STAGES[pipelineStageIndex + 1].titleKey) }),
                      onClick: () =>
                        navigate(
                          pipelineStageIndex + 1 === OFFER_STAGE_INDEX
                            ? '/pipeline/offer'
                            : `/pipeline/stage/${pipelineStageIndex + 1}`,
                        ),
                    }
                  : null
              }
              referenceSolutions={pipelineMode && interviewer.id === 'cto' ? STAGE3_REFERENCE_SOLUTIONS : null}
              referenceOpen={showReference}
              onToggleReference={() => setShowReference((v) => !v)}
              lang={lang}
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

        {/* Meet toolbar: grouped pills — mic/camera/captions/present/more, hangup, info/people/chat.
            Present/More/Info/People are permanently-disabled stubs, so they collapse away below
            tablet width (see .control-btn--decorative) to keep the bar usable on a phone. */}
        <footer className="meet-toolbar">
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
            <ControlButton label={t('meet.controls.notAvailable')} decorative disabled>
              <PresentIcon />
            </ControlButton>
            <ControlButton label={t('meet.controls.notAvailable')} decorative disabled>
              <MoreVertIcon />
            </ControlButton>
          </div>

          <ControlButton label={t('meet.controls.hangup')} tone="#f44336" wide onClick={handleHangup}>
            <CallEndIcon />
          </ControlButton>

          <div style={{ display: 'flex', gap: '0.5rem', background: '#2a2b2f', borderRadius: 999, padding: 6 }}>
            <ControlButton label={t('meet.controls.notAvailable')} decorative disabled>
              <InfoIcon />
            </ControlButton>
            <ControlButton label={t('meet.controls.notAvailable')} decorative disabled>
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

      {/* Always mounted (not conditionally rendered) so the open/close transition can
          actually animate; `inert` drops it from tab order and hit-testing while closed. */}
      <aside
        className={`meet-sidebar${messagesOpen ? ' meet-sidebar--open' : ''}`}
        inert={!messagesOpen || undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>{t('meet.messagesTitle')}</h2>
          <button
            type="button"
            className="meet-sidebar-close"
            onClick={() => setMessagesOpen(false)}
            aria-label={t('meet.controls.closeChat')}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.map((m, idx) => {
              const isTask = m.author === 'interviewer' && 'questionIndex' in m && Boolean(selectedQuestions[m.questionIndex]?.isTaskPrompt)
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.author === 'user' ? 'flex-end' : 'flex-start',
                    background: m.author === 'user' ? interviewer.color : '#2a2b33',
                    color: m.author === 'user' ? '#1c1d23' : '#f3f4f6',
                    borderRadius: 12,
                    padding: '0.5rem 0.75rem',
                    maxWidth: isTask ? '100%' : '85%',
                    whiteSpace: 'pre-wrap',
                    fontFamily: isTask ? 'monospace' : undefined,
                    fontSize: isTask ? 12 : undefined,
                  }}
                >
                  {m.author === 'user' ? m.text : interviewerMessageText(m)}
                </div>
              )
            })}
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
                disabled={Boolean(streaming)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid #383944', background: '#1c1d23', color: 'inherit' }}
              />
              <button onClick={handleSend} disabled={Boolean(streaming)}>
                {t('meet.send')}
              </button>
            </div>
          )}
      </aside>
    </main>
  )
}

function AssessmentCard({
  assessment,
  interviewerRole,
  onViewHistory,
  pipelineCta,
  referenceSolutions,
  referenceOpen,
  onToggleReference,
  lang,
}: {
  assessment: ReturnType<typeof assessSession>
  interviewerRole: string
  onViewHistory: () => void
  pipelineCta: { label: string; onClick: () => void } | null
  referenceSolutions: typeof STAGE3_REFERENCE_SOLUTIONS | null
  referenceOpen: boolean
  onToggleReference: () => void
  lang: 'en' | 'ua'
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

      {referenceSolutions && (
        <div style={{ margin: '0 0 1rem' }}>
          <button onClick={onToggleReference} style={{ width: '100%' }}>
            {referenceOpen ? t('pipeline.hideReference') : t('pipeline.showReference')}
          </button>
          {referenceOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {referenceSolutions.map((sol) => (
                <pre
                  key={sol.taskId}
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    background: '#111318',
                    border: '1px solid #2e303a',
                    borderRadius: 8,
                    padding: '0.5rem 0.75rem',
                    margin: 0,
                  }}
                >
                  {sol[lang]}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}

      {pipelineCta ? (
        <button onClick={pipelineCta.onClick} style={{ width: '100%' }}>
          {pipelineCta.label}
        </button>
      ) : (
        <button onClick={onViewHistory} style={{ width: '100%' }}>
          {t('meet.viewHistory')}
        </button>
      )}
    </div>
  )
}

function ControlButton({
  label,
  tone = '#3c4043',
  active,
  disabled,
  wide,
  decorative,
  title,
  onClick,
  children,
}: {
  label: string
  tone?: string
  active?: boolean
  disabled?: boolean
  wide?: boolean
  /** Non-functional stub controls (Present/More/Info/People) — hidden below tablet width. */
  decorative?: boolean
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
      className={`control-btn${wide ? ' control-btn--wide' : ''}${decorative ? ' control-btn--decorative' : ''}`}
      style={{
        border: 'none',
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

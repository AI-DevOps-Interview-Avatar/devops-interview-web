import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MockLlmBackend } from '../../api/llmClient'
import type { MediaPipeLlmBackend } from '../../api/llm/mediaPipeBackend'
import { buildRemarkPrompt, cleanRemark, hasReachedStop, type TranscriptTurn } from '../../api/llm/promptBuilder'
import { selectLlmBackend } from '../../api/llm/selectBackend'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { QUESTION_BANKS, PIPELINE_QUESTION_SETS } from '../../domain/models/questionBank'
import { STAGE3_REFERENCE_SOLUTIONS } from '../../domain/models/stage3Tasks'
import { assessSession, sessionLevel } from '../../domain/assessment'
import { canEnterStage, OFFER_STAGE_INDEX, PIPELINE_STAGES } from '../../domain/pipeline'
import { addMessage, MAX_QUESTIONS, requestNextQuestion, startInterview } from '../../store/interviewSlice'
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
import { isLanguageSpeakable, speak, stopSpeaking, subscribeSpeaking } from '../../shared/voice/tts'
import {
  isSpeechRecognitionSupported,
  startListening,
  type ListeningHandle,
  type SpeechErrorCode,
} from '../../shared/voice/stt'
import type { RootState } from '../../store'

/**
 * Where overlays on the video tile start, in px from its top edge: clear of
 * .meet-chrome (16px offset + a 44px tap target) plus a gap. They used to start
 * at 24 and sat under Back/Home once the chrome grew to a real touch size.
 */
const OVERLAY_TOP = 72

export default function MeetSessionPage() {
  const params = useParams<{ interviewerId?: string; stageIndex?: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation()
  const { messages, selectedQuestions, finished, pendingQuestionIndex, questionCount } = useSelector(
    (state: RootState) => state.interview,
  )
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
  // Drives the on-video recording banner: 'listening' while the mic is live,
  // then 'sent'/'empty' for a couple seconds after it stops so the user gets
  // explicit start/stop feedback instead of the mic icon silently changing.
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'listening' | 'sent' | 'empty'>('idle')
  // Sticks around until the next mic press, unlike the transient banner above:
  // "allow the microphone in your browser settings" is an instruction to act on,
  // not a notification to glance at.
  const [micError, setMicError] = useState<SpeechErrorCode | null>(null)
  /** True only while audio is actually playing — drives the avatar's mouth. */
  const [speaking, setSpeaking] = useState(false)
  /** Set when the browser has no voice at all for the interview language. */
  const [voiceUnavailable, setVoiceUnavailable] = useState(false)
  const [showReference, setShowReference] = useState(false)
  /**
   * True once the on-device model is loaded and this interview is genuinely
   * being reacted to by it. Drives the badge — a candidate should never have to
   * guess whether the person on screen is a model or a script.
   */
  const [onDevice, setOnDevice] = useState(false)
  /** Paces out the bank questions, which are already written and translated. */
  const backendRef = useRef(new MockLlmBackend())
  /** The real model, when this device has one. Null until it has loaded, and on most devices forever. */
  const engineRef = useRef<MediaPipeLlmBackend | null>(null)
  const listeningHandleRef = useRef<ListeningHandle | null>(null)
  const capturedTranscriptRef = useRef(false)
  const historySavedRef = useRef(false)
  const stageCompletedRef = useRef(false)
  /** Language the interview is currently spoken in; null until the first render settles it. */
  const spokenLangRef = useRef<'en' | 'ua' | null>(null)

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
    // (mount → cleanup → mount), which would otherwise run two overlapping
    // greetings before the first question is even requested.
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
      dispatch(requestNextQuestion())
    }
    run()

    return () => {
      cancelled = true
      // Pipeline stages swap the interviewer without unmounting the page, so
      // this is the only place that releases the previous stage's audio.
      stopSpeaking()
      listeningHandleRef.current?.abort()
      listeningHandleRef.current = null
      setListening(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId])

  // The rig's mouth follows the synthesizer, not the token stream that produced
  // the text — those are different moments, and the old wiring animated the
  // wrong one.
  useEffect(() => subscribeSpeaking(setSpeaking), [])

  /**
   * Loads the on-device model in the background, if this device has one.
   *
   * Deliberately not awaited by anything. Starting a MediaPipe graph over 528 MB
   * of weights takes tens of seconds on the hardware this was measured on, and
   * blocking the greeting on it would trade a working scripted interview for a
   * loading screen. The interview runs from the first second either way; the
   * model joins in when it is ready, and on most devices — no WebGPU, or no
   * bundle imported — it never does, which is the state `selectLlmBackend`
   * exists to report rather than hide.
   */
  useEffect(() => {
    let cancelled = false
    let loaded: MediaPipeLlmBackend | null = null

    void selectLlmBackend().then((selection) => {
      if (selection.kind !== 'mediapipe') return
      const engine = selection.backend as MediaPipeLlmBackend
      // Half a gigabyte of GPU memory belongs to a page that has already gone.
      if (cancelled) {
        engine.close()
        return
      }
      loaded = engine
      engineRef.current = engine
      setOnDevice(true)
    })

    return () => {
      cancelled = true
      engineRef.current = null
      loaded?.close()
    }
  }, [])

  // A locale with no installed voice produces silence rather than an error, so
  // without this the candidate just waits for audio that is never coming.
  useEffect(() => {
    let cancelled = false
    void isLanguageSpeakable(lang).then((speakable) => {
      if (!cancelled) setVoiceUnavailable(!speakable)
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  // Single owner of every audio resource this page holds. The interview effect
  // above only tears down on interviewer change, which left the synthesizer and
  // an open recognition session alive across navigation — reopening a recruiter
  // then landed on a wedged Chrome queue and a dead mic until a hard refresh.
  useEffect(() => {
    const releaseAudio = () => {
      stopSpeaking()
      listeningHandleRef.current?.abort()
      listeningHandleRef.current = null
    }
    // pagehide covers the bfcache/mobile paths where beforeunload never fires.
    window.addEventListener('beforeunload', releaseAudio)
    window.addEventListener('pagehide', releaseAudio)
    return () => {
      window.removeEventListener('beforeunload', releaseAudio)
      window.removeEventListener('pagehide', releaseAudio)
      releaseAudio()
    }
  }, [])

  useEffect(() => {
    if (finished) {
      // The last question is usually still being spoken when the final answer
      // lands — without this the recruiter keeps talking over Session Summary.
      stopSpeaking()
      // abort(), not stop(): the interview is over, so a flush here would post
      // an answer into a session that has already been assessed.
      listeningHandleRef.current?.abort()
      listeningHandleRef.current = null
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
      level: sessionLevel(selectedQuestions),
      finishedAt: new Date().toISOString(),
      ...assessment,
    })
  }

  // Produces whichever question the reducer asked for. Keyed on `lang` as well,
  // so switching language mid-generation restarts this run: the half-streamed
  // sentence is abandoned and the question is asked again in the new language,
  // instead of the recruiter finishing the old one several messages later.
  useEffect(() => {
    if (pendingQuestionIndex === null || !interviewer) return
    const questionIndex = pendingQuestionIndex
    const question = selectedQuestions[questionIndex]
    if (!question) return
    // Captured up front: narrowing from the guard above does not survive into
    // the async closure below.
    const { voiceGender } = interviewer

    let cancelled = false
    async function ask() {
      // Local buffer rather than a functional setState: a restarted run then
      // replaces the caption outright instead of appending to the leftovers of
      // the language it just abandoned.
      let buffer = ''
      const full = await backendRef.current.generate(question[lang], (token) => {
        buffer += token
        if (!cancelled) setStreaming(buffer)
      })
      if (cancelled) return
      dispatch(addMessage({ author: 'interviewer', questionIndex }))
      setStreaming('')
      speak(full, lang, voiceGender)
    }
    void ask()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestionIndex, lang])

  // Switching language re-translates the transcript on screen instantly
  // (messages hold a question index, not text), so audio still playing in the
  // old language now contradicts what the candidate is reading.
  useEffect(() => {
    if (spokenLangRef.current === null) {
      spokenLangRef.current = lang
      return
    }
    if (spokenLangRef.current === lang) return
    spokenLangRef.current = lang
    if (!interviewer || finished) return

    stopSpeaking()
    // A question already in flight is regenerated and spoken by the effect
    // above — re-speaking here would talk over it.
    if (pendingQuestionIndex !== null) return

    const last = [...messages].reverse().find((m) => m.author === 'interviewer')
    if (!last || !('questionIndex' in last)) return
    const question = selectedQuestions[last.questionIndex]
    if (question) speak(question[lang], lang, interviewer.voiceGender)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  /** The conversation so far, in the form the prompt builder wants it. */
  function transcriptTurns(): TranscriptTurn[] {
    const turns: TranscriptTurn[] = []

    for (const message of messages) {
      if (message.author === 'user') {
        turns.push({ role: 'candidate', text: message.text })
        continue
      }
      if ('questionIndex' in message) {
        const asked = selectedQuestions[message.questionIndex]?.[lang]
        if (asked) turns.push({ role: 'interviewer', text: asked })
        continue
      }
      if ('remark' in message) {
        turns.push({ role: 'interviewer', text: message.remark })
        continue
      }
      turns.push({
        role: 'interviewer',
        text: t(`interviewers.${interviewerId}.greeting`, { name: interviewer?.voiceName ?? '' }),
      })
    }

    return turns
  }

  /**
   * The model reacts, then the bank asks.
   *
   * Order is the whole feature. The remark is a reaction to what was just said,
   * so it has to land before the next question changes the subject — and the
   * next question is still the reducer's to choose, which is why this ends with
   * the same intent-only dispatch it replaced rather than naming an index.
   *
   * Everything here is skippable by design: no model, no more questions, a
   * generation that fails — each falls through to the question, because the
   * interview is the product and the remark is a nicety on top of it.
   */
  async function reactThenAsk(answer: string) {
    const engine = engineRef.current
    // `questionCount` is the committed number of questions asked, so this is
    // the same test the reducer will apply. Reacting after the final answer
    // would put a follow-up on screen underneath the Session Summary.
    const moreQuestionsComing = questionCount < selectedQuestions.length

    if (!engine || !interviewer || !moreQuestionsComing) {
      dispatch(requestNextQuestion())
      return
    }

    const { voiceGender, voiceName, role } = interviewer
    const prompt = buildRemarkPrompt({
      personaName: voiceName,
      personaRole: role,
      lang,
      transcript: [...transcriptTurns(), { role: 'candidate', text: answer }],
    })

    try {
      let buffer = ''
      let stopped = false

      await engine.generate(prompt, (token) => {
        // MediaPipe offers no way to abort a generation, so stopping means
        // ignoring the rest of it: past `<end_of_turn>` the model is writing
        // the candidate's lines for them.
        if (stopped) return
        buffer += token
        if (hasReachedStop(buffer)) stopped = true
        setStreaming(cleanRemark(buffer, voiceName))
      })

      const remark = cleanRemark(buffer, voiceName)
      setStreaming('')

      if (remark) {
        dispatch(addMessage({ author: 'interviewer', remark, lang }))
        await new Promise<void>((resolve) => speak(remark, lang, voiceGender, resolve))
      }
    } catch {
      // A busy graph, a driver reset, a model that produced nothing usable. The
      // candidate gets the next question rather than an error they cannot act on.
      setStreaming('')
    }

    dispatch(requestNextQuestion())
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    dispatch(addMessage({ author: 'user', text: trimmed }))
    setDraft('')
    // Intent only — the reducer decides which question is next, and rejects a
    // second request while one is already open. The remark, when there is one,
    // goes in front of that intent rather than alongside it.
    void reactThenAsk(trimmed)
  }

  function handleSend() {
    sendMessage(draft)
  }

  /** Everything that must happen before this page goes away, whatever route triggers it. */
  function leaveSession() {
    stopSpeaking()
    listeningHandleRef.current?.abort()
    listeningHandleRef.current = null
    saveToHistory()
  }

  function handleHangup() {
    leaveSession()
    navigate(pipelineMode ? '/pipeline' : '/interview')
  }

  // 'sent'/'empty' are transient — flip back to 'idle' after a couple seconds
  // so the on-video banner doesn't linger forever after recording stops.
  useEffect(() => {
    if (recordingStatus !== 'sent' && recordingStatus !== 'empty') return
    const id = setTimeout(() => setRecordingStatus('idle'), 2500)
    return () => clearTimeout(id)
  }, [recordingStatus])

  function toggleListening() {
    // Keyed off the live handle rather than `listening`, which only turns true
    // once the recognizer reports onstart — otherwise a press landing in that
    // window would open a second session on top of the first.
    if (listeningHandleRef.current) {
      // Closes and flushes synchronously, so the button flips on this tick
      // instead of waiting seconds for the service to finalize.
      listeningHandleRef.current.stop()
      return
    }
    stopSpeaking()
    setMicError(null)
    capturedTranscriptRef.current = false
    listeningHandleRef.current = startListening(lang, {
      // Only now is the mic genuinely live — showing "listening" any earlier is
      // a guess, and it was wrong exactly when the session failed to start.
      onStart: () => {
        setListening(true)
        setRecordingStatus('listening')
      },
      onResult: (transcript) => {
        // The recognizer keeps listening (continuous mode) until the user stops
        // it, so this fires once with the full answer — send it straight away
        // rather than waiting for a manual "Send".
        capturedTranscriptRef.current = true
        const combined = draft ? `${draft} ${transcript}` : transcript
        sendMessage(combined)
      },
      onEnd: () => {
        setListening(false)
        listeningHandleRef.current = null
        setRecordingStatus(capturedTranscriptRef.current ? 'sent' : 'empty')
      },
      onError: setMicError,
    })
  }

  const assessment = useMemo(
    () => (finished ? assessSession(messages, selectedQuestions) : null),
    [finished, messages, selectedQuestions],
  )

  if (!interviewer) {
    return <p>Interviewer not found.</p>
  }

  const voiceName = interviewer.voiceName
  function interviewerMessageText(
    m:
      | { author: 'interviewer'; questionIndex: number }
      | { author: 'interviewer'; greeting: true }
      | { author: 'interviewer'; remark: string; lang: 'en' | 'ua' },
  ) {
    if ('questionIndex' in m) return selectedQuestions[m.questionIndex]?.[lang]
    // Held as text, and shown as it was said: a generated line has no key to
    // look up in the other language (DIA-158).
    if ('remark' in m) return m.remark
    return t(`interviewers.${interviewerId}.greeting`, { name: voiceName })
  }

  const lastInterviewerMessage = [...messages].reverse().find((m) => m.author === 'interviewer')
  const caption =
    streaming ||
    (lastInterviewerMessage?.author === 'interviewer' ? interviewerMessageText(lastInterviewerMessage) : '')

  return (
    <main className="meet-shell">
      <section className="meet-main">
        <div className="meet-chrome">
          <PageNav onBeforeNavigate={leaveSession} />
          <LanguageSwitcher />
        </div>

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
              {/* Was a flat 280px, which on a phone in landscape left no room
                  for the toolbar under it. Bounded by both axes now. */}
              <AvatarTile interviewer={interviewer} isSpeaking={speaking} size="min(280px, 70vw, 45vh)" />
              <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>{interviewer.voiceName}</p>
              {/* Stated, never implied. A candidate is answering questions about
                  their own career; whether a model on their machine is listening
                  and replying is not something to leave them guessing about. */}
              {onDevice && (
                <p data-testid="engine-badge" style={{ margin: '0.15rem 0 0', color: '#9ca3af', fontSize: 12 }}>
                  {t('meet.onDevice')}
                </p>
              )}
            </div>
          )}

          {!finished && micError && (
            <AlertBanner testId="mic-error">{t(`meet.controls.micErrors.${micError}`)}</AlertBanner>
          )}

          {/* Sits below the mic error so both can be true at once — a machine
              with no Ukrainian voice pack often has no microphone either. */}
          {!finished && voiceUnavailable && (
            <AlertBanner testId="voice-unavailable" tone="warning" top={micError ? OVERLAY_TOP + 52 : OVERLAY_TOP}>
              {t('meet.controls.voiceUnavailable')}
            </AlertBanner>
          )}

          {/* Hidden while an error is up: the two would otherwise stack, and the
              error text already says everything "No speech detected" would. */}
          {!finished && !micError && recordingStatus !== 'idle' && (
            <div
              data-testid="recording-status"
              style={{
                position: 'absolute',
                top: OVERLAY_TOP,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(0,0,0,0.6)',
                padding: '0.4rem 0.9rem',
                borderRadius: 999,
                fontSize: 13,
              }}
            >
              {recordingStatus === 'listening' && (
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#f44336',
                      animation: 'meet-rec-pulse 1.2s ease-in-out infinite',
                    }}
                  />
                  {t('meet.controls.listening')}
                </>
              )}
              {recordingStatus === 'sent' && `✓ ${t('meet.controls.recordingSent')}`}
              {recordingStatus === 'empty' && t('meet.controls.recordingEmpty')}
            </div>
          )}

          {!finished && captionsOn && caption && (
            <p
              data-testid="caption"
              style={{
                position: 'absolute',
                bottom: 'clamp(12px, 3vw, 24px)',
                left: 'clamp(12px, 4vw, 24px)',
                right: 'clamp(12px, 4vw, 24px)',
                // A long question in Ukrainian is several lines on a phone; the
                // caption scrolls inside its own box rather than growing up
                // over the avatar.
                maxHeight: '35%',
                overflowY: 'auto',
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
              testId="mic"
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
              testId="captions"
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

          <ControlButton testId="hangup" label={t('meet.controls.hangup')} tone="#f44336" wide onClick={handleHangup}>
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
              testId="chat-toggle"
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
                  data-testid="message"
                  data-author={m.author}
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
            {/* Derived, not stored: aborting the mic on `finished` deliberately
                skips its onEnd, so `listening` can still be true here. */}
            {listening && !finished && (
              <div style={{ alignSelf: 'center', color: '#9ca3af', fontSize: 13 }}>{t('meet.controls.listening')}</div>
            )}
          </div>
          {!finished && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                data-testid="chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('meet.sendPlaceholder') ?? ''}
                disabled={Boolean(streaming)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 'var(--tap-target)',
                  padding: '0.5rem',
                  borderRadius: 8,
                  border: '1px solid #383944',
                  background: '#1c1d23',
                  color: 'inherit',
                }}
              />
              <button data-testid="send" onClick={handleSend} disabled={Boolean(streaming)}>
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
      data-testid="assessment"
      style={{
        background: '#1c1d23',
        border: '1px solid #2e303a',
        borderRadius: 16,
        padding: 'clamp(1rem, 4vw, 1.5rem)',
        width: 'min(92%, 420px)',
        // The tile clips its overflow, so on a short screen the card has to
        // scroll itself or its CTA becomes unreachable.
        maxHeight: '100%',
        overflowY: 'auto',
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
        <button data-testid="pipeline-continue" onClick={pipelineCta.onClick} style={{ width: '100%' }}>
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

/** Overlaid notice on the video tile: something the candidate needs to act on. */
function AlertBanner({
  children,
  testId,
  tone = 'error',
  top = OVERLAY_TOP,
}: {
  children: React.ReactNode
  /** Stable hook for tests: the copy inside is localized, and half of them switch locale. */
  testId?: string
  tone?: 'error' | 'warning'
  top?: number
}) {
  const palette =
    tone === 'error'
      ? { background: 'rgba(120, 26, 26, 0.92)', border: '#f4433680' }
      : { background: 'rgba(120, 90, 20, 0.92)', border: '#f5a62380' }
  return (
    <div
      role="alert"
      data-testid={testId}
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'min(90%, 460px)',
        background: palette.background,
        border: `1px solid ${palette.border}`,
        padding: '0.5rem 0.9rem',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.35,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

function ControlButton({
  label,
  testId,
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
  /** Same reason as AlertBanner: the accessible name is localized. */
  testId?: string
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
      data-testid={testId}
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

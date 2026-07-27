export type VoiceLang = 'en' | 'ua'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

/**
 * Every way voice capture can fail, narrowed to the cases we have UI copy for.
 * The spec's codes are collapsed where the user's next action is identical
 * (`service-not-allowed` is still "the browser won't give us the mic").
 *
 * `busy` is ours, not the spec's: `start()` throwing InvalidStateError because
 * the previous session is still winding down.
 */
export type SpeechErrorCode =
  | 'no-speech'
  | 'not-allowed'
  | 'audio-capture'
  | 'network'
  | 'language-not-supported'
  | 'busy'
  | 'unknown'

const ERROR_CODES: Record<string, SpeechErrorCode> = {
  'no-speech': 'no-speech',
  'not-allowed': 'not-allowed',
  'service-not-allowed': 'not-allowed',
  'audio-capture': 'audio-capture',
  network: 'network',
  'language-not-supported': 'language-not-supported',
}

/** Maps a raw `SpeechRecognitionErrorEvent.error` onto a code we can render. */
export function normalizeSpeechError(raw: string): SpeechErrorCode {
  return ERROR_CODES[raw] ?? 'unknown'
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export interface ListeningCallbacks {
  /** Fires once, with the full transcript, when the session closes. */
  onResult: (transcript: string) => void
  /** Fires exactly once per session, however it ended. */
  onEnd: () => void
  /** The recognizer is actually live — the only honest cue for a "listening" indicator. */
  onStart?: () => void
  /** A failure the user can act on. Never fires for a session the caller aborted. */
  onError?: (code: SpeechErrorCode) => void
}

export interface ListeningHandle {
  /**
   * Ends capture now and flushes what was recognized so far.
   *
   * Deliberately backed by `abort()` rather than `stop()`: `stop()` waits for
   * the recognition service to finalize, which is the 2-3 second lag the mic
   * button used to have. Interim results are off, so every finalized chunk is
   * already accumulated locally and nothing is lost by cutting the session.
   */
  stop: () => void
  /**
   * Kills the session without reporting anything back. For teardown, where
   * `stop()`'s flush would push a transcript into a screen that is going away.
   */
  abort: () => void
}

/**
 * Starts voice capture and keeps listening until the caller stops it.
 * `continuous: true` is the key bit here: without it the browser closes the
 * recognition session on the first short pause it detects (e.g. a breath
 * mid-sentence), which is what used to cut answers off and drop their last
 * words. With it, the session stays open and accumulates each finalized
 * chunk until the user is done talking; only then is the full transcript
 * flushed via `onResult`.
 *
 * Returns null if capture could not start — `onError` says why, so the button
 * is never silently inert.
 */
export function startListening(lang: VoiceLang, callbacks: ListeningCallbacks): ListeningHandle | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const { onResult, onEnd, onStart, onError } = callbacks
  const recognition = new Ctor()
  recognition.lang = LANG_TAGS[lang]
  recognition.continuous = true
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  let finalTranscript = ''
  let closed = false

  function detach() {
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
  }

  /**
   * The one exit point. Runs at most once per session, whichever of `onend`,
   * `onerror` or the caller's `stop()` gets there first — otherwise a stop
   * followed by the engine's own `onend` would send the answer twice.
   */
  function close(flush: boolean) {
    if (closed) return
    closed = true
    detach()
    if (flush && finalTranscript) onResult(finalTranscript)
    onEnd()
  }

  recognition.onstart = () => onStart?.()

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result.isFinal) continue
      const chunk = result[0].transcript.trim()
      if (chunk) finalTranscript = finalTranscript ? `${finalTranscript} ${chunk}` : chunk
    }
  }

  // Mid-session errors used to leave the mic stuck showing "listening" with no
  // way to recover short of a page reload, and every cause — permission denied,
  // no microphone, an unreachable recognition service — surfaced as the same
  // "No speech detected". Now the code reaches the UI and the session closes.
  recognition.onerror = (event) => {
    // Our own stop(); close() below already handles that path.
    if (event.error === 'aborted') return
    onError?.(normalizeSpeechError(event.error))
    close(true)
  }

  recognition.onend = () => close(true)

  try {
    recognition.start()
  } catch {
    detach()
    onError?.('busy')
    return null
  }

  return {
    stop: () => {
      try {
        recognition.abort()
      } catch {
        // Session already dead — close() below still reports the result.
      }
      close(true)
    },
    abort: () => {
      // Suppress the flush before touching the recognizer: abort() fires onend,
      // and running the normal end path while the component is unmounting would
      // push a transcript into a session that no longer exists.
      closed = true
      detach()
      try {
        recognition.abort()
      } catch {
        // Session already dead — nothing left to release.
      }
    },
  }
}

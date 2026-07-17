export type VoiceLang = 'en' | 'ua'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export interface ListeningHandle {
  stop: () => void
}

/**
 * Starts voice capture and keeps listening until the caller calls `stop()`.
 * `continuous: true` is the key bit here: without it the browser closes the
 * recognition session on the first short pause it detects (e.g. a breath
 * mid-sentence), which is what used to cut answers off and drop their last
 * words. With it, the session stays open and accumulates each finalized
 * chunk until the user is done talking; only then is the full transcript
 * flushed via `onResult`.
 *
 * Returns null if the browser has no SpeechRecognition.
 */
export function startListening(
  lang: VoiceLang,
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onStart?: () => void,
): ListeningHandle | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = LANG_TAGS[lang]
  recognition.continuous = true
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  let finalTranscript = ''

  recognition.onstart = () => onStart?.()

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result.isFinal) continue
      const chunk = result[0].transcript.trim()
      if (chunk) finalTranscript = finalTranscript ? `${finalTranscript} ${chunk}` : chunk
    }
  }

  // Mid-session errors (e.g. 'no-speech' after a long silence, or a network
  // hiccup talking to the recognition service) used to leave the mic stuck
  // showing "listening" forever with no way to recover short of a page
  // reload. Routing them through stop() guarantees onend still fires and
  // flushes whatever was captured so far, or `onEnd()` runs directly if the
  // session was already dead and stop() itself throws.
  recognition.onerror = () => {
    try {
      recognition.stop()
    } catch {
      onEnd()
    }
  }

  recognition.onend = () => {
    if (finalTranscript) onResult(finalTranscript)
    onEnd()
  }

  try {
    recognition.start()
  } catch {
    return null
  }

  return { stop: () => recognition.stop() }
}

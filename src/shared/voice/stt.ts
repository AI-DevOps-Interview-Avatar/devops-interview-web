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

/** Starts one-shot voice capture; returns null if the browser has no SpeechRecognition. */
export function startListening(
  lang: VoiceLang,
  onResult: (transcript: string) => void,
  onEnd: () => void,
): ListeningHandle | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = LANG_TAGS[lang]
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1]
    onResult(lastResult[0].transcript)
  }
  recognition.onerror = () => onEnd()
  recognition.onend = () => onEnd()

  recognition.start()
  return { stop: () => recognition.stop() }
}

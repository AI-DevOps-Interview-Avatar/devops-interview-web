export type VoiceLang = 'en' | 'ua'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Speaks `text` aloud, canceling any utterance already in progress. */
export function speak(text: string, lang: VoiceLang, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = LANG_TAGS[lang]

  const voices = window.speechSynthesis.getVoices()
  const match = voices.find((voice) => voice.lang.startsWith(LANG_TAGS[lang].split('-')[0]))
  if (match) {
    utterance.voice = match
  }

  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

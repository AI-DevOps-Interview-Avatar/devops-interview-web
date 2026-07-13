export type VoiceLang = 'en' | 'ua'
export type VoiceGender = 'male' | 'female'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

// Name substrings seen across Chrome/Edge/Safari/espeak voice lists that
// reliably indicate gender — voice objects have no explicit gender field.
const NAME_HINTS: Record<VoiceGender, string[]> = {
  male: ['male', 'david', 'daniel', 'alex', 'fred', 'mark', 'guy', 'ryan', 'george', 'james', 'thomas'],
  female: ['female', 'samantha', 'victoria', 'karen', 'susan', 'zira', 'aria', 'emma', 'olivia', 'moira', 'tessa'],
}

// Fallback when no gender-hinted voice is installed (common on headless/Linux
// Chromium with a single default voice): shift pitch/rate so Marcus/David
// still read as distinctly male next to Emma/Olivia.
const GENDER_PROSODY: Record<VoiceGender, { pitch: number; rate: number }> = {
  male: { pitch: 0.8, rate: 0.95 },
  female: { pitch: 1.15, rate: 1.02 },
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(lang: VoiceLang, gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const langPrefix = LANG_TAGS[lang].split('-')[0]
  const sameLanguage = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix))
  const pool = sameLanguage.length > 0 ? sameLanguage : voices

  const hints = NAME_HINTS[gender]
  const byName = pool.find((voice) => hints.some((hint) => voice.name.toLowerCase().includes(hint)))
  return byName ?? null
}

/** Speaks `text` aloud in `gender`'s voice, canceling any utterance already in progress. */
export function speak(text: string, lang: VoiceLang, gender: VoiceGender, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = LANG_TAGS[lang]

  const voice = pickVoice(lang, gender)
  if (voice) {
    utterance.voice = voice
  }
  const prosody = GENDER_PROSODY[gender]
  utterance.pitch = prosody.pitch
  utterance.rate = prosody.rate

  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

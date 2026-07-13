export type VoiceLang = 'en' | 'ua'
export type VoiceGender = 'male' | 'female'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

// Name substrings seen across Chrome/Edge/Safari/espeak voice lists that
// reliably indicate gender — voice objects have no explicit gender field.
// Includes English hints plus common Ukrainian/Russian TTS voice names
// (Microsoft/Google/eSpeak-ng ship these under both language packs).
const NAME_HINTS: Record<VoiceGender, string[]> = {
  male: [
    'male', 'david', 'daniel', 'alex', 'fred', 'mark', 'guy', 'ryan', 'george', 'james', 'thomas',
    'ostap', 'pavel', 'yuri', 'yuriy', 'dmytro', 'anton', 'artem', 'ivan', 'stepan', 'kyrylo',
  ],
  female: [
    'female', 'samantha', 'victoria', 'karen', 'susan', 'zira', 'aria', 'emma', 'olivia', 'moira', 'tessa',
    'polina', 'milena', 'lesya', 'natalia', 'nataliya', 'oksana', 'kateryna', 'olena', 'irina', 'anastasia',
  ],
}

// Fallback when no gender-hinted voice is installed (common on headless/Linux
// Chromium with a single default voice): shift pitch/rate so Marcus/David
// still read as distinctly male next to Emma/Olivia. Kept wide apart since
// on a single shared voice this is the only signal telling them apart.
const GENDER_PROSODY: Record<VoiceGender, { pitch: number; rate: number }> = {
  male: { pitch: 0.7, rate: 0.92 },
  female: { pitch: 1.25, rate: 1.05 },
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(lang: VoiceLang, gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const langPrefix = LANG_TAGS[lang].split('-')[0]
  const sameLanguage = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix))
    // Network-backed voices (e.g. Chrome's "Google ..." voices) sound far
    // more natural than a local engine like eSpeak-ng — prefer them first.
    .sort((a, b) => Number(a.localService) - Number(b.localService))
  // Browsers speak in the assigned voice's own language regardless of
  // utterance.lang, so falling back to a cross-language voice here would
  // silently keep speaking English after switching the UI to Ukrainian.
  // No matching voice for this language → leave utterance.voice unset below
  // and let the browser pick its own default for utterance.lang.
  if (sameLanguage.length === 0) return null

  const hints = NAME_HINTS[gender]
  const byName = sameLanguage.find((voice) => hints.some((hint) => voice.name.toLowerCase().includes(hint)))
  if (byName) return byName

  // Nothing named for this gender. If there's more than one voice for the
  // language, split them deterministically across genders so male/female
  // personas still use genuinely distinct voices instead of collapsing onto
  // the exact same one (pitch/rate alone can sound like a bad impression).
  if (sameLanguage.length > 1) {
    const sorted = [...sameLanguage].sort((a, b) => a.name.localeCompare(b.name))
    const half = Math.ceil(sorted.length / 2)
    const pool = gender === 'female' ? sorted.slice(0, half) : sorted.slice(half)
    return (pool.length > 0 ? pool : sorted)[0]
  }

  return null
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

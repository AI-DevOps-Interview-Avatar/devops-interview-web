export type VoiceLang = 'en' | 'ua'
export type VoiceGender = 'male' | 'female'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

/** How long to wait for the browser to populate its voice list before giving up on it. */
const VOICES_TIMEOUT_MS = 2000

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

// Only used when a language ships a single voice and both genders collapse onto
// it — then pitch/rate is the one thing keeping Marcus from sounding exactly
// like Emma. Kept deliberately shallow (±0.12): a wider shift is what made the
// network-backed "Google українська" voice in Chrome sound choppy and slurred,
// while Edge's local voice — spoken untouched — sounded fine.
const GENDER_PROSODY: Record<VoiceGender, { pitch: number; rate: number }> = {
  male: { pitch: 0.88, rate: 0.96 },
  female: { pitch: 1.12, rate: 1.04 },
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null

/**
 * Resolves once the browser has actually populated its voice list.
 *
 * Chrome fills `getVoices()` asynchronously and fires `voiceschanged` when it's
 * ready, so reading it synchronously on first paint usually returns an empty
 * array. Every caller then silently fell through to the browser default, which
 * is why a persona's voice — and its gender — changed at random between runs
 * and why English sessions often started with no audio at all.
 *
 * Resolves with whatever exists after `timeoutMs` on engines that never fire
 * the event; an empty result is not cached so a later call can retry.
 */
export function voicesReady(timeoutMs = VOICES_TIMEOUT_MS): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([])
  if (voicesPromise) return voicesPromise

  const synth = window.speechSynthesis
  const immediate = synth.getVoices()
  if (immediate.length > 0) {
    voicesPromise = Promise.resolve(immediate)
    return voicesPromise
  }

  voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      if (voices.length === 0) voicesPromise = null
      resolve(voices)
    }
    const onVoicesChanged = () => finish(synth.getVoices())
    const timer = setTimeout(() => finish(synth.getVoices()), timeoutMs)
    synth.addEventListener('voiceschanged', onVoicesChanged)
  })

  return voicesPromise
}

/** Drops the memoized voice list. Exists for tests and for engines that hot-swap voice packs. */
export function resetVoiceCache(): void {
  voicesPromise = null
}

export interface VoiceSelection {
  voice: SpeechSynthesisVoice | null
  /**
   * True only when the language ships a single voice, so male and female
   * personas unavoidably share it. This is the one case where prosody nudging
   * is applied — on a properly gendered voice it only degrades quality.
   */
  sharedVoiceFallback: boolean
}

/**
 * Picks a persona's voice deterministically: same input list → same voice,
 * every session. `getVoices()` order is not guaranteed stable across calls in
 * Chrome, so every ranking step below has an explicit tiebreak by name.
 */
export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  lang: VoiceLang,
  gender: VoiceGender,
): VoiceSelection {
  const langPrefix = LANG_TAGS[lang].split('-')[0]
  const sameLanguage = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix))
    // Network-backed voices (e.g. Chrome's "Google ..." voices) sound far more
    // natural than a local engine like eSpeak-ng — prefer them first, then fall
    // back to alphabetical order so the choice never depends on list ordering.
    .sort((a, b) => Number(a.localService) - Number(b.localService) || a.name.localeCompare(b.name))
  // Browsers speak in the assigned voice's own language regardless of
  // utterance.lang, so falling back to a cross-language voice here would
  // silently keep speaking English after switching the UI to Ukrainian.
  // No matching voice for this language → leave utterance.voice unset and let
  // the browser pick its own default for utterance.lang.
  if (sameLanguage.length === 0) return { voice: null, sharedVoiceFallback: false }

  const hints = NAME_HINTS[gender]
  const byName = sameLanguage.find((voice) => hints.some((hint) => voice.name.toLowerCase().includes(hint)))
  if (byName) return { voice: byName, sharedVoiceFallback: false }

  // Nothing named for this gender. If there's more than one voice for the
  // language, split them deterministically across genders so male/female
  // personas still use genuinely distinct voices instead of collapsing onto
  // the exact same one (pitch/rate alone can sound like a bad impression).
  if (sameLanguage.length > 1) {
    const sorted = [...sameLanguage].sort((a, b) => a.name.localeCompare(b.name))
    const half = Math.ceil(sorted.length / 2)
    const pool = gender === 'female' ? sorted.slice(0, half) : sorted.slice(half)
    return { voice: (pool.length > 0 ? pool : sorted)[0], sharedVoiceFallback: false }
  }

  return { voice: sameLanguage[0], sharedVoiceFallback: true }
}

// Every speak()/stopSpeaking() call takes the next token. An utterance that was
// still waiting on voicesReady() when the token moved on has been superseded and
// must not reach the synthesizer — otherwise a recruiter starts talking over the
// Session Summary that just replaced them.
let activeSpeechToken = 0

function resetSynth(): void {
  const synth = window.speechSynthesis
  synth.cancel()
  // Chrome leaves its queue wedged in a paused state when cancel() lands
  // mid-utterance: every later speak() then silently no-ops until a full page
  // reload — the "voice is dead after reopening a recruiter" bug. resume()
  // clears that flag and is a harmless no-op when nothing is paused.
  synth.resume()
}

/** Speaks `text` aloud in `gender`'s voice, canceling any utterance already in progress. */
export function speak(text: string, lang: VoiceLang, gender: VoiceGender, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd?.()
    return
  }

  const token = ++activeSpeechToken
  resetSynth()

  void voicesReady().then((voices) => {
    // Superseded while the voice list was loading. `onEnd` still has to run so
    // callers awaiting this utterance (the greeting) don't hang forever.
    if (token !== activeSpeechToken) {
      onEnd?.()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANG_TAGS[lang]

    const { voice, sharedVoiceFallback } = resolveVoice(voices, lang, gender)
    if (voice) {
      utterance.voice = voice
    }
    if (sharedVoiceFallback) {
      const prosody = GENDER_PROSODY[gender]
      utterance.pitch = prosody.pitch
      utterance.rate = prosody.rate
    }

    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()

    window.speechSynthesis.speak(utterance)
  })
}

/** Hard-stops playback and invalidates any utterance still waiting on the voice list. */
export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return
  activeSpeechToken += 1
  resetSynth()
}

export type VoiceLang = 'en' | 'ua'
export type VoiceGender = 'male' | 'female'

const LANG_TAGS: Record<VoiceLang, string> = { en: 'en-US', ua: 'uk-UA' }

/** How long to wait for the browser to populate its voice list before giving up on it. */
const VOICES_TIMEOUT_MS = 2000

// Chrome stops synthesis roughly 15 seconds into a continuous run and never
// reports an error — the chat and subtitles kept scrolling while the recruiter
// went mute mid-interview. Two independent guards against it: no single
// utterance is long enough to reach the cutoff, and a timer keeps nudging the
// engine while a queue is playing.
/** Upper bound per utterance — about 10 seconds of speech at a normal rate. */
const CHUNK_MAX_CHARS = 160
/** Nudge interval, comfortably under the cutoff. */
const KEEP_ALIVE_MS = 9000

// Name substrings seen across Chrome/Edge/Safari/espeak voice lists that
// reliably indicate gender — voice objects have no explicit gender field.
// Includes English hints plus common Ukrainian/Russian TTS voice names
// (Microsoft/Google/eSpeak-ng ship these under both language packs).
//
// Getting a name onto these lists matters more than it looks: an unrecognised
// name falls through to the split below, which keeps the personas distinct but
// has no idea which half is which — on a Linux box running RHVoice that handed
// Marcus a female voice and Emma a male one.
const NAME_HINTS: Record<VoiceGender, string[]> = {
  male: [
    'male', 'david', 'daniel', 'alex', 'fred', 'mark', 'guy', 'ryan', 'george', 'james', 'thomas',
    'ostap', 'pavel', 'yuri', 'yuriy', 'dmytro', 'anton', 'artem', 'ivan', 'stepan', 'kyrylo',
    // RHVoice, the usual Ukrainian synthesizer on Linux. 'bdl' and 'evgeniy'
    // are its CMU-derived English voices, which carry no obvious given name.
    'anatol', 'volodymyr', 'alan', 'bdl', 'evgeniy',
  ],
  female: [
    'female', 'samantha', 'victoria', 'karen', 'susan', 'zira', 'aria', 'emma', 'olivia', 'moira', 'tessa',
    'polina', 'milena', 'lesya', 'natalia', 'nataliya', 'oksana', 'kateryna', 'olena', 'irina', 'anastasia',
    // RHVoice — 'clb' and 'slt' are its CMU-derived English voices.
    'marianna', 'lyubov', 'clb', 'slt',
  ],
}

/**
 * Whole-word matching, which a plain substring search is not.
 *
 * "female" contains "male", so a substring search handed the male persona
 * "Google UK English Female" — the first voice in the list that technically
 * matched. Chrome's own voice set names its voices exactly that way, so this
 * misfired on any machine using it. A word boundary keeps the two apart while
 * still matching "Evgeniy-Eng", where the hyphen is a boundary too.
 */
const NAME_PATTERNS: Record<VoiceGender, RegExp> = {
  male: new RegExp(`\\b(?:${NAME_HINTS.male.join('|')})\\b`, 'i'),
  female: new RegExp(`\\b(?:${NAME_HINTS.female.join('|')})\\b`, 'i'),
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

function langPrefixOf(lang: VoiceLang): string {
  return LANG_TAGS[lang].split('-')[0]
}

/**
 * Whether this browser can speak `lang` at all.
 *
 * A locale with no installed voice produces silence, not an error: the engine
 * accepts the utterance and says nothing. Callers use this to warn instead of
 * leaving the candidate waiting for audio that is never coming.
 */
export async function isLanguageSpeakable(lang: VoiceLang): Promise<boolean> {
  if (!isSpeechSynthesisSupported()) return false
  const voices = await voicesReady()
  // An empty list means the engine never reported its voices — assume it can
  // still speak with its default rather than raising a false alarm.
  if (voices.length === 0) return true
  return voices.some((voice) => voice.lang.toLowerCase().startsWith(langPrefixOf(lang)))
}

// Whether audio is actually coming out right now. The avatar rig used to be
// driven by token streaming instead, so the mouth moved while the text was
// being generated and went still exactly when the recruiter started talking.
type SpeakingListener = (speaking: boolean) => void
const speakingListeners = new Set<SpeakingListener>()
let speakingNow = false

function setSpeaking(next: boolean): void {
  if (speakingNow === next) return
  speakingNow = next
  speakingListeners.forEach((listener) => listener(next))
}

/**
 * Subscribes to playback start/stop. Returns an unsubscribe function.
 *
 * The listener is not called on subscribe — only on change — so it is safe to
 * wire straight into an effect.
 */
export function subscribeSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener)
  return () => {
    speakingListeners.delete(listener)
  }
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
  const langPrefix = langPrefixOf(lang)
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

  const byName = sameLanguage.find((voice) => NAME_PATTERNS[gender].test(voice.name))
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

/**
 * Breaks `text` into utterance-sized pieces on sentence boundaries.
 *
 * The browser plays queued utterances back-to-back, so splitting costs no
 * audible gap — but it does keep every individual utterance well under the
 * duration where Chrome gives up. A sentence longer than the budget is cut on
 * the last comma or space that fits, never mid-word.
 *
 * Returns an empty array for blank input.
 */
export function splitIntoChunks(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const chunks: string[] = []
  let current = ''

  const push = (piece: string) => {
    const trimmed = piece.trim()
    if (trimmed) chunks.push(trimmed)
  }

  // Keeps the terminator and trailing space attached to its sentence.
  for (const sentence of text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]) {
    if (!sentence.trim()) continue

    if (current.length + sentence.length <= maxChars) {
      current += sentence
      continue
    }

    push(current)

    let rest = sentence
    while (rest.length > maxChars) {
      const window = rest.slice(0, maxChars)
      const comma = window.lastIndexOf(', ')
      const space = window.lastIndexOf(' ')
      const cut = comma > 0 ? comma + 1 : space > 0 ? space : maxChars
      push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }

  push(current)
  return chunks
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null

function stopKeepAlive(): void {
  if (keepAliveTimer === null) return
  clearInterval(keepAliveTimer)
  keepAliveTimer = null
}

function startKeepAlive(): void {
  stopKeepAlive()
  keepAliveTimer = setInterval(() => {
    const synth = window.speechSynthesis
    if (!synth.speaking) {
      // Nothing left to keep alive — don't leave the timer running.
      stopKeepAlive()
      return
    }
    // pause() immediately followed by resume() resets Chrome's internal cutoff
    // timer with no audible seam; on engines without the bug it's a no-op pair.
    synth.pause()
    synth.resume()
  }, KEEP_ALIVE_MS)
}

// Every speak()/stopSpeaking() call takes the next token. An utterance that was
// still waiting on voicesReady() when the token moved on has been superseded and
// must not reach the synthesizer — otherwise a recruiter starts talking over the
// Session Summary that just replaced them.
let activeSpeechToken = 0

/**
 * Resolves the caller's `onEnd` for the utterance run currently queued. Kept
 * module-level so a cancel path can settle it: the greeting is awaited, and
 * leaving that promise unresolved would stall the interview before its first
 * question.
 */
let activeRunSettle: (() => void) | null = null

function endActiveRun(): void {
  const settle = activeRunSettle
  activeRunSettle = null
  stopKeepAlive()
  setSpeaking(false)
  settle?.()
}

function resetSynth(): void {
  const synth = window.speechSynthesis
  stopKeepAlive()
  setSpeaking(false)
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
  endActiveRun()

  void voicesReady().then((voices) => {
    // Superseded while the voice list was loading. `onEnd` still has to run so
    // callers awaiting this utterance (the greeting) don't hang forever.
    if (token !== activeSpeechToken) {
      onEnd?.()
      return
    }

    const chunks = splitIntoChunks(text)
    if (chunks.length === 0) {
      onEnd?.()
      return
    }

    const { voice, sharedVoiceFallback } = resolveVoice(voices, lang, gender)
    const synth = window.speechSynthesis
    let remaining = chunks.length
    let settled = false

    activeRunSettle = () => {
      if (settled) return
      settled = true
      onEnd?.()
    }

    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = LANG_TAGS[lang]
      if (voice) {
        utterance.voice = voice
      }
      if (sharedVoiceFallback) {
        const prosody = GENDER_PROSODY[gender]
        utterance.pitch = prosody.pitch
        utterance.rate = prosody.rate
      }

      utterance.onend = () => {
        // A superseded run is settled by whoever superseded it.
        if (token !== activeSpeechToken) return
        remaining -= 1
        if (remaining === 0) endActiveRun()
      }
      // A failed chunk takes the rest of the queue down with it in practice, so
      // don't wait on siblings that will never speak.
      utterance.onerror = () => {
        if (token !== activeSpeechToken) return
        endActiveRun()
      }

      synth.speak(utterance)
    }

    // Queued, so audio is milliseconds away. Deliberately not waiting for the
    // first `onstart`: engines that never fire it would leave the avatar frozen
    // through the whole answer.
    setSpeaking(true)
    startKeepAlive()
  })
}

/** Hard-stops playback and invalidates any utterance still waiting on the voice list. */
export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return
  activeSpeechToken += 1
  resetSynth()
  endActiveRun()
}

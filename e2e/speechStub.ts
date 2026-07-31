import type { Page } from '@playwright/test'

/**
 * A fake Web Speech API, installed before the app's first line runs.
 *
 * Headless Chromium ships no speech at all: `getVoices()` is empty and
 * `webkitSpeechRecognition` needs Google API keys it does not have. Testing
 * against that would only ever prove the app survives having no voice.
 *
 * So the engine is replaced with one that behaves like a real browser's —
 * voices arriving late through `voiceschanged`, utterances queued and ended in
 * order, `cancel()` leaving the queue paused the way Chrome does — and records
 * what the app asked it to say. The assertions are then about our code: which
 * persona got which voice, in which language, whether playback stopped when the
 * interview did. The engines' own behaviour is not ours to test, and
 * `docs/voice-matrix.md` records it instead.
 */

/** Voice lists as the real browsers report them; same fixtures as tts.test.ts. */
export const VOICE_SETS = {
  chrome: [
    { name: 'Microsoft Ostap - Ukrainian (Ukraine)', lang: 'uk-UA', localService: true },
    { name: 'Microsoft Polina - Ukrainian (Ukraine)', lang: 'uk-UA', localService: true },
    { name: 'Google українська', lang: 'uk-UA', localService: false },
    { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
  ],
  /** Safari on macOS: one Ukrainian voice for both personas — the shared-voice fallback. */
  safari: [
    { name: 'Lesya', lang: 'uk-UA', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
    { name: 'Alex', lang: 'en-US', localService: true },
  ],
  /** Chrome on Linux: no Ukrainian at all, which is what the warning banner is for. */
  noUkrainian: [
    { name: 'Google US English', lang: 'en-US', localService: false },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Google UK English Male', lang: 'en-GB', localService: false },
  ],
  /** An engine that reports nothing — treated as "might still speak", never as an error. */
  empty: [] as Array<{ name: string; lang: string; localService: boolean }>,
}

export type VoiceSetName = keyof typeof VOICE_SETS

export interface SpokenUtterance {
  text: string
  lang: string
  voice: string | null
  pitch: number
  rate: number
  /** Set when the utterance was cut off by cancel() rather than finishing. */
  cancelled: boolean
}

export interface SpeechProbe {
  spoken: () => Promise<SpokenUtterance[]>
  speaking: () => Promise<boolean>
  /** Everything spoken since the marker, for asserting about one step of a flow. */
  since: (marker: number) => Promise<SpokenUtterance[]>
  mark: () => Promise<number>
}

declare global {
  interface Window {
    __speech: {
      spoken: SpokenUtterance[]
      /** Delivers a transcript to the live recognition session, as a real engine would. */
      say: (transcript: string) => void
      /** Fails the live recognition session with a spec error code. */
      failWith: (code: string) => void
      recognitionStarts: number
    }
  }
}

interface StubOptions {
  voices?: VoiceSetName
  /** How long each utterance "plays" — long enough to observe, short enough not to drag. */
  utteranceMs?: number
  /** Delay before `voiceschanged` fires, mimicking Chrome's late voice list. */
  voicesDelayMs?: number
  /** Leave SpeechRecognition undefined, as Firefox and Safari do. */
  withoutRecognition?: boolean
}

export async function installSpeechStub(page: Page, options: StubOptions = {}): Promise<SpeechProbe> {
  const config = {
    voices: VOICE_SETS[options.voices ?? 'chrome'],
    utteranceMs: options.utteranceMs ?? 60,
    voicesDelayMs: options.voicesDelayMs ?? 30,
    withoutRecognition: options.withoutRecognition ?? false,
  }

  await page.addInitScript((cfg: typeof config) => {
    // Every `page.goto` is a fresh document, and a fresh document would lose
    // the log — which is exactly what the "reopen the recruiter ten times"
    // scenarios are about. sessionStorage carries it across, so `mark()` taken
    // before a navigation still means something after one.
    const LOG_KEY = '__speech_log'
    const spoken: SpokenUtterance[] = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]')
    const persist = () => sessionStorage.setItem(LOG_KEY, JSON.stringify(spoken))
    const listeners = new Map<string, Set<() => void>>()
    let queue: Array<{ utterance: FakeUtterance; timer: number }> = []
    let voicesPublished = false

    interface FakeUtterance {
      text: string
      lang: string
      voice: { name: string; lang: string } | null
      pitch: number
      rate: number
      onend: (() => void) | null
      onerror: (() => void) | null
      record: SpokenUtterance
    }

    class Utterance implements FakeUtterance {
      text: string
      lang = ''
      voice: { name: string; lang: string } | null = null
      pitch = 1
      rate = 1
      volume = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      onstart: (() => void) | null = null
      record!: SpokenUtterance
      constructor(text: string) {
        this.text = text
      }
    }

    const voices = cfg.voices.map((voice) => ({
      ...voice,
      voiceURI: voice.name,
      default: false,
    }))

    const synth = {
      // Empty until "the browser finishes loading them", exactly like Chrome.
      getVoices: () => (voicesPublished ? voices : []),
      speak(utterance: Utterance) {
        const record: SpokenUtterance = {
          text: utterance.text,
          lang: utterance.lang,
          voice: utterance.voice?.name ?? null,
          pitch: utterance.pitch,
          rate: utterance.rate,
          cancelled: false,
        }
        utterance.record = record
        spoken.push(record)
        persist()
        synth.speaking = true
        utterance.onstart?.()
        const timer = window.setTimeout(() => {
          queue = queue.filter((entry) => entry.utterance !== utterance)
          if (queue.length === 0) synth.speaking = false
          utterance.onend?.()
        }, cfg.utteranceMs)
        queue.push({ utterance, timer })
      },
      cancel() {
        for (const entry of queue) {
          window.clearTimeout(entry.timer)
          entry.utterance.record.cancelled = true
        }
        persist()
        queue = []
        synth.speaking = false
        // Chrome leaves the queue paused after a mid-utterance cancel; the app
        // calls resume() to clear it, and that behaviour is worth reproducing.
        synth.paused = true
      },
      pause() {
        synth.paused = true
      },
      resume() {
        synth.paused = false
      },
      speaking: false,
      paused: false,
      pending: false,
      addEventListener(type: string, listener: () => void) {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(listener)
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener)
      },
    }

    window.setTimeout(() => {
      voicesPublished = true
      listeners.get('voiceschanged')?.forEach((listener) => listener())
    }, cfg.voicesDelayMs)

    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true })

    // --- Recognition -------------------------------------------------------
    /** The one open recognition session, exactly as a real engine allows. */
    let live: Recognition | null = null

    class Recognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart: (() => void) | null = null
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null

      start() {
        // A second start() while one session is open throws InvalidStateError,
        // which is the 'busy' path the app has to survive.
        if (live) throw new DOMException('already started', 'InvalidStateError')
        live = this as Recognition
        window.__speech.recognitionStarts += 1
        window.setTimeout(() => this.onstart?.(), 0)
      }
      stop() {
        live = null
        this.onend?.()
      }
      abort() {
        const wasLive = live !== null
        live = null
        // Real engines report the abort before ending, and the app relies on
        // telling that apart from a genuine failure.
        if (wasLive) this.onerror?.({ error: 'aborted' })
        this.onend?.()
      }
    }

    // Chromium ships `webkitSpeechRecognition` of its own, so "this browser has
    // no recognition" has to be stated rather than merely not stubbed.
    const recognitionCtor = cfg.withoutRecognition ? undefined : Recognition
    Object.defineProperty(window, 'SpeechRecognition', { value: recognitionCtor, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: recognitionCtor, configurable: true })

    window.__speech = {
      spoken,
      recognitionStarts: 0,
      say(transcript: string) {
        const results = [Object.assign([{ transcript, confidence: 1 }], { isFinal: true, length: 1 })]
        live?.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) })
      },
      failWith(code: string) {
        live?.onerror?.({ error: code })
      },
    }
  }, config)

  // Optional chaining throughout: a probe may legitimately be read before the
  // first navigation, when the page is still about:blank and the init script
  // has not run anywhere. "Nothing has been spoken yet" is the honest answer
  // there, not a crash inside the helper.
  return {
    spoken: () => page.evaluate(() => window.__speech?.spoken ?? []),
    speaking: () => page.evaluate(() => window.speechSynthesis?.speaking ?? false),
    mark: () => page.evaluate(() => window.__speech?.spoken.length ?? 0),
    since: (marker: number) => page.evaluate((from) => window.__speech?.spoken.slice(from) ?? [], marker),
  }
}

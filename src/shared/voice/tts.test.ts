import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isLanguageSpeakable,
  resetVoiceCache,
  resolveVoice,
  speak,
  splitIntoChunks,
  stopSpeaking,
  subscribeSpeaking,
  voicesReady,
} from './tts'

type FakeVoice = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return { name, lang, localService } as FakeVoice as SpeechSynthesisVoice
}

interface FakeUtterance {
  text: string
  lang: string
  voice: SpeechSynthesisVoice | null
  pitch: number
  rate: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

/**
 * Stubs just enough of the Web Speech API to drive tts.ts in the `node` test
 * environment. `voices` starts empty and only fills once `emitVoicesChanged()`
 * runs — that's exactly Chrome's timing, and the bug this module now handles.
 */
function stubSpeechSynthesis(voices: SpeechSynthesisVoice[], { async = false } = {}) {
  const spoken: FakeUtterance[] = []
  const listeners: Array<() => void> = []
  let available = async ? [] : voices
  let cancelCalls = 0
  let resumeCalls = 0
  let pauseCalls = 0
  let speaking = false

  const synth = {
    getVoices: () => available,
    get speaking() {
      return speaking
    },
    speak: (utterance: FakeUtterance) => {
      spoken.push(utterance)
      speaking = true
    },
    cancel: () => {
      cancelCalls += 1
      speaking = false
      spoken.length = 0
    },
    pause: () => {
      pauseCalls += 1
    },
    resume: () => {
      resumeCalls += 1
    },
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    removeEventListener: (_type: string, listener: () => void) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  }

  class FakeSpeechSynthesisUtterance {
    text: string
    lang = ''
    voice: SpeechSynthesisVoice | null = null
    pitch = 1
    rate = 1
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(text: string) {
      this.text = text
    }
  }

  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance)
  resetVoiceCache()

  return {
    spoken,
    get cancelCalls() {
      return cancelCalls
    },
    get resumeCalls() {
      return resumeCalls
    },
    get pauseCalls() {
      return pauseCalls
    },
    /** Plays out the whole queue: every utterance reports `end`, like a finished run. */
    drain: () => {
      speaking = false
      spoken.slice().forEach((utterance) => utterance.onend?.())
    },
    emitVoicesChanged: () => {
      available = voices
      listeners.slice().forEach((listener) => listener())
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
  // Before the stub goes away: the module tracks whether audio is playing, and
  // a test that ends mid-utterance would otherwise hand that state to the next.
  if (typeof window !== 'undefined') stopSpeaking()
  vi.unstubAllGlobals()
  resetVoiceCache()
})

describe('voicesReady', () => {
  it('waits for voiceschanged instead of returning Chrome’s initially empty list', async () => {
    const synth = stubSpeechSynthesis([voice('Google українська', 'uk-UA', false)], { async: true })

    const pending = voicesReady()
    synth.emitVoicesChanged()

    expect(await pending).toHaveLength(1)
  })

  it('does not cache an empty result, so a later call can retry', async () => {
    const target = [voice('Microsoft Ostap', 'uk-UA')]
    const synth = stubSpeechSynthesis(target, { async: true })
    vi.useFakeTimers()

    const first = voicesReady(2000)
    vi.advanceTimersByTime(2000)
    expect(await first).toEqual([])
    vi.useRealTimers()

    synth.emitVoicesChanged()
    expect(await voicesReady()).toEqual(target)
  })
})

describe('resolveVoice', () => {
  const ukrainian = [
    voice('Google українська', 'uk-UA', false),
    voice('Microsoft Ostap - Ukrainian (Ukraine)', 'uk-UA'),
    voice('Microsoft Polina - Ukrainian (Ukraine)', 'uk-UA'),
  ]

  it('binds a persona to the same voice regardless of getVoices() ordering', () => {
    const shuffled = [ukrainian[2], ukrainian[0], ukrainian[1]]

    expect(resolveVoice(ukrainian, 'ua', 'female').voice?.name).toBe(
      resolveVoice(shuffled, 'ua', 'female').voice?.name,
    )
    expect(resolveVoice(ukrainian, 'ua', 'male').voice?.name).toBe(
      resolveVoice(shuffled, 'ua', 'male').voice?.name,
    )
  })

  it('keeps male and female personas on genuinely different voices', () => {
    const male = resolveVoice(ukrainian, 'ua', 'male')
    const female = resolveVoice(ukrainian, 'ua', 'female')

    expect(male.voice?.name).not.toBe(female.voice?.name)
    expect(male.sharedVoiceFallback).toBe(false)
    expect(female.sharedVoiceFallback).toBe(false)
  })

  it('never crosses languages — an English-only list yields no Ukrainian voice', () => {
    const selection = resolveVoice([voice('Microsoft David - English (US)', 'en-US')], 'ua', 'male')

    expect(selection.voice).toBeNull()
    // The engine may still speak it in some default voice, identical for every
    // persona, so prosody has to do the separating.
    expect(selection.sharedVoiceFallback).toBe(true)
  })

  it('flags the shared-voice fallback when a language ships exactly one voice', () => {
    const single = [voice('eSpeak Ukrainian', 'uk')]

    expect(resolveVoice(single, 'ua', 'male').sharedVoiceFallback).toBe(true)
    expect(resolveVoice(single, 'ua', 'female').sharedVoiceFallback).toBe(true)
  })
})

/**
 * Voice lists as the browsers actually report them on a Windows 10 machine —
 * the platform the exploratory testing ran on. Chrome adds its network-backed
 * "Google" voices on top of the system ones; Edge ships the same Microsoft
 * pack; Safari (macOS) has neither and its Ukrainian coverage is a single
 * voice, which is the case that forces the shared-voice fallback.
 */
const BROWSER_VOICES = {
  chrome: [
    voice('Microsoft Ostap - Ukrainian (Ukraine)', 'uk-UA'),
    voice('Microsoft Polina - Ukrainian (Ukraine)', 'uk-UA'),
    voice('Google українська', 'uk-UA', false),
    voice('Microsoft David - English (United States)', 'en-US'),
    voice('Microsoft Zira - English (United States)', 'en-US'),
    voice('Google US English', 'en-US', false),
  ],
  edge: [
    voice('Microsoft Ostap - Ukrainian (Ukraine)', 'uk-UA'),
    voice('Microsoft Polina - Ukrainian (Ukraine)', 'uk-UA'),
    voice('Microsoft David - English (United States)', 'en-US'),
    voice('Microsoft Zira - English (United States)', 'en-US'),
  ],
  safari: [voice('Lesya', 'uk-UA'), voice('Samantha', 'en-US'), voice('Alex', 'en-US')],
  // Linux has no system voices of its own: every browser goes through
  // speech-dispatcher, and RHVoice is what actually speaks Ukrainian well.
  // None of these names look like the Microsoft or Apple ones.
  rhvoice: [
    voice('Anatol', 'uk'),
    voice('Marianna', 'uk'),
    voice('Natalia', 'uk'),
    voice('Volodymyr', 'uk'),
    voice('Alan', 'en'),
    voice('Bdl', 'en'),
    voice('Clb', 'en'),
    voice('Evgeniy-Eng', 'en'),
    voice('Lyubov', 'en'),
    voice('Slt', 'en'),
  ],
}

/**
 * Chrome's own voice set on Linux, where it ignores speech-dispatcher unless
 * launched with `--enable-speech-dispatcher`. Trimmed to the languages we care
 * about — note there is no Ukrainian in it at all, which is what the
 * unspeakable-locale warning is for.
 */
const CHROME_BUILTIN_VOICES = [
  voice('Google US English', 'en-US', false),
  voice('Google UK English Female', 'en-GB', false),
  voice('Google UK English Male', 'en-GB', false),
  voice('Google polski', 'pl-PL', false),
  voice('Google русский', 'ru-RU', false),
]

/** Which voices are actually male or female, per engine, so a wrong pick is caught. */
const MALE_VOICES = new Set([
  'Microsoft Ostap - Ukrainian (Ukraine)',
  'Microsoft David - English (United States)',
  'Alex',
  'Anatol',
  'Volodymyr',
  'Alan',
  'Bdl',
  'Evgeniy-Eng',
])

describe('resolveVoice across real browser voice lists', () => {
  for (const [browser, voices] of Object.entries(BROWSER_VOICES)) {
    it(`keeps each persona on its own gendered voice in ${browser}`, () => {
      for (const lang of ['ua', 'en'] as const) {
        const male = resolveVoice(voices, lang, 'male')
        const female = resolveVoice(voices, lang, 'female')

        expect(male.voice, `${browser}/${lang}/male`).not.toBeNull()
        expect(female.voice, `${browser}/${lang}/female`).not.toBeNull()
        // Safari's single Ukrainian voice is the one case where both personas
        // legitimately share it — and then prosody has to do the separating.
        if (male.sharedVoiceFallback) {
          expect(male.voice?.name).toBe(female.voice?.name)
        } else {
          expect(male.voice?.name, `${browser}/${lang}`).not.toBe(female.voice?.name)
        }
      }
    })

    it(`puts each persona on a voice of its own gender in ${browser}`, () => {
      // Distinct voices are not enough: the split fallback happily hands the
      // male persona a female voice when it does not recognise the names.
      for (const lang of ['ua', 'en'] as const) {
        const male = resolveVoice(voices, lang, 'male')
        const female = resolveVoice(voices, lang, 'female')

        if (male.sharedVoiceFallback) continue // one voice for the locale, prosody separates them
        expect(MALE_VOICES.has(male.voice?.name ?? ''), `${browser}/${lang} male → ${male.voice?.name}`).toBe(true)
        expect(MALE_VOICES.has(female.voice?.name ?? ''), `${browser}/${lang} female → ${female.voice?.name}`).toBe(
          false,
        )
      }
    })

    it(`never leaks a voice from another language in ${browser}`, () => {
      for (const gender of ['male', 'female'] as const) {
        expect(resolveVoice(voices, 'ua', gender).voice?.lang.toLowerCase()).toMatch(/^uk/)
        expect(resolveVoice(voices, 'en', gender).voice?.lang.toLowerCase()).toMatch(/^en/)
      }
    })
  }

  it('does not read "Female" as a match for the male persona', () => {
    // 'female' contains 'male', so a substring search put Marcus on
    // "Google UK English Female" — the first voice that technically matched.
    const male = resolveVoice(CHROME_BUILTIN_VOICES, 'en', 'male')
    const female = resolveVoice(CHROME_BUILTIN_VOICES, 'en', 'female')

    expect(male.voice?.name).toBe('Google UK English Male')
    expect(female.voice?.name).toBe('Google UK English Female')
  })

  it('reports no voice at all for a locale Chrome cannot speak', () => {
    // Chrome's built-in set covers Russian and Polish but not Ukrainian.
    const male = resolveVoice(CHROME_BUILTIN_VOICES, 'ua', 'male')
    const female = resolveVoice(CHROME_BUILTIN_VOICES, 'ua', 'female')

    expect(male.voice).toBeNull()
    expect(female.voice).toBeNull()
    // Chrome hands the utterance to the system synthesizer anyway, which uses
    // one voice for everyone — without a prosody nudge every persona would
    // sound the same.
    expect(male.sharedVoiceFallback).toBe(true)
    expect(female.sharedVoiceFallback).toBe(true)
  })

  it('gives the same answer however the browser orders its list', () => {
    const reversed = [...BROWSER_VOICES.chrome].reverse()

    for (const gender of ['male', 'female'] as const) {
      expect(resolveVoice(BROWSER_VOICES.chrome, 'ua', gender).voice?.name).toBe(
        resolveVoice(reversed, 'ua', gender).voice?.name,
      )
    }
  })
})

describe('isLanguageSpeakable', () => {
  it('reports a locale the browser cannot speak', async () => {
    stubSpeechSynthesis([voice('Microsoft Zira - English (United States)', 'en-US')])

    expect(await isLanguageSpeakable('en')).toBe(true)
    expect(await isLanguageSpeakable('ua')).toBe(false)
  })

  it('stays quiet when the engine never reported any voices at all', async () => {
    // No list is not the same as no coverage — the engine may still speak with
    // its own default, and a false alarm here would be worse than silence.
    const synth = stubSpeechSynthesis([], { async: true })
    vi.useFakeTimers()
    const pending = isLanguageSpeakable('ua')
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()
    synth.emitVoicesChanged()

    expect(await pending).toBe(true)
  })
})

describe('subscribeSpeaking', () => {
  it('reports playback start and stop, and stops reporting once unsubscribed', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])
    const states: boolean[] = []
    const unsubscribe = subscribeSpeaking((value) => states.push(value))

    speak('Розкажіть про себе', 'ua', 'female')
    await vi.waitFor(() => expect(states).toEqual([true]))

    synth.drain()
    expect(states).toEqual([true, false])

    unsubscribe()
    speak('Ще питання', 'ua', 'female')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))
    expect(states).toEqual([true, false])
  })

  it('goes quiet when playback is cancelled mid-answer', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])
    const states: boolean[] = []
    const unsubscribe = subscribeSpeaking((value) => states.push(value))

    speak('Довге питання', 'ua', 'female')
    await vi.waitFor(() => expect(synth.spoken.length).toBeGreaterThan(0))
    stopSpeaking()

    expect(states).toEqual([true, false])
    unsubscribe()
  })
})

describe('splitIntoChunks', () => {
  const long = 'Розкажіть про свій досвід з Kubernetes. Які саме кластери ви обслуговували? '
  const maxChars = 160

  it('keeps every chunk under the limit Chrome can finish', () => {
    for (const chunk of splitIntoChunks(long.repeat(6), maxChars)) {
      expect(chunk.length).toBeLessThanOrEqual(maxChars)
    }
  })

  it('cuts on sentence boundaries, never mid-word', () => {
    const chunks = splitIntoChunks(long.repeat(4), maxChars)

    expect(chunks.length).toBeGreaterThan(1)
    // Rejoining must reproduce the original wording — a mid-word cut would
    // show up here as a missing or doubled space inside a word.
    expect(chunks.join(' ')).toBe(long.repeat(4).trim().replace(/\s+/g, ' '))
  })

  it('splits a single over-long sentence without dropping text', () => {
    const runOn = `Опишіть ${'дуже '.repeat(80)}довгий процес`
    const chunks = splitIntoChunks(runOn, maxChars)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= maxChars)).toBe(true)
    expect(chunks.join(' ')).toBe(runOn.replace(/\s+/g, ' '))
  })

  it('yields nothing for blank text so speak() has nothing to queue', () => {
    expect(splitIntoChunks('   ')).toEqual([])
  })
})

describe('speak', () => {
  it('leaves prosody untouched on a properly gendered voice', async () => {
    const synth = stubSpeechSynthesis([
      voice('Microsoft Ostap - Ukrainian (Ukraine)', 'uk-UA'),
      voice('Microsoft Polina - Ukrainian (Ukraine)', 'uk-UA'),
    ])

    speak('Розкажіть про себе', 'ua', 'male')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))

    expect(synth.spoken[0].pitch).toBe(1)
    expect(synth.spoken[0].rate).toBe(1)
  })

  it('nudges prosody only when both personas share the single available voice', async () => {
    const synth = stubSpeechSynthesis([voice('eSpeak Ukrainian', 'uk')])

    speak('Розкажіть про себе', 'ua', 'male')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))

    expect(synth.spoken[0].pitch).toBeCloseTo(0.88)
    expect(Math.abs(1 - synth.spoken[0].pitch)).toBeLessThanOrEqual(0.15)
  })

  it('separates the personas by pitch when the locale has no voice of its own', async () => {
    // Chrome on Linux: no Ukrainian voice in the list, but the system
    // synthesizer speaks the utterance anyway — in one voice, for everyone.
    const synth = stubSpeechSynthesis([voice('Google US English', 'en-US', false)])

    speak('Розкажіть про себе', 'ua', 'male')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))
    const malePitch = synth.spoken[0].pitch

    stopSpeaking()
    speak('Розкажіть про себе', 'ua', 'female')
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))

    expect(synth.spoken[0].voice).toBeNull()
    expect(malePitch).toBeLessThan(1)
    expect(synth.spoken[0].pitch).toBeGreaterThan(1)
  })

  it('does not reach the synthesizer when stopSpeaking() lands while voices are still loading', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')], { async: true })
    const onEnd = vi.fn()

    speak('Останнє питання', 'ua', 'female', onEnd)
    stopSpeaking()
    synth.emitVoicesChanged()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())
    expect(synth.spoken).toHaveLength(0)
  })

  it('queues a long answer as several utterances and reports end only once the last one finishes', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])
    const onEnd = vi.fn()
    const longAnswer = 'Розкажіть про свій досвід з Kubernetes. Які кластери ви обслуговували? '.repeat(5)

    speak(longAnswer, 'ua', 'female', onEnd)
    await vi.waitFor(() => expect(synth.spoken.length).toBeGreaterThan(1))

    // Partial drain: the run is not over while utterances are still queued.
    synth.spoken[0].onend?.()
    expect(onEnd).not.toHaveBeenCalled()

    synth.drain()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('nudges the engine while a queue plays and drops the timer once it drains', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])
    // Timers must be faked before speak() so the keep-alive interval it starts
    // is the fake one. The voice list is already loaded, so a couple of
    // microtask turns is all it takes to queue the run — no timer involved.
    vi.useFakeTimers()
    speak('Перше речення. Друге речення. Третє речення.', 'ua', 'female')
    await Promise.resolve()
    await Promise.resolve()
    expect(synth.spoken.length).toBeGreaterThan(0)

    vi.advanceTimersByTime(9000)
    expect(synth.pauseCalls).toBe(1)
    expect(synth.resumeCalls).toBe(2) // one from speak()'s reset, one from the nudge

    synth.drain()
    vi.advanceTimersByTime(90_000)
    expect(synth.pauseCalls).toBe(1) // interval cleared — no leaked timer
    vi.useRealTimers()
  })

  it('unwedges Chrome’s paused queue by resuming after every cancel', () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])

    speak('Привіт', 'ua', 'female')
    stopSpeaking()

    expect(synth.cancelCalls).toBe(2)
    expect(synth.resumeCalls).toBe(2)
  })
})

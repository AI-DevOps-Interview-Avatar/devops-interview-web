import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetVoiceCache, resolveVoice, speak, stopSpeaking, voicesReady } from './tts'

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

  const synth = {
    getVoices: () => available,
    speak: (utterance: FakeUtterance) => spoken.push(utterance),
    cancel: () => {
      cancelCalls += 1
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
    emitVoicesChanged: () => {
      available = voices
      listeners.slice().forEach((listener) => listener())
    },
  }
}

afterEach(() => {
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
    expect(selection.sharedVoiceFallback).toBe(false)
  })

  it('flags the shared-voice fallback when a language ships exactly one voice', () => {
    const single = [voice('eSpeak Ukrainian', 'uk')]

    expect(resolveVoice(single, 'ua', 'male').sharedVoiceFallback).toBe(true)
    expect(resolveVoice(single, 'ua', 'female').sharedVoiceFallback).toBe(true)
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

  it('does not reach the synthesizer when stopSpeaking() lands while voices are still loading', async () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')], { async: true })
    const onEnd = vi.fn()

    speak('Останнє питання', 'ua', 'female', onEnd)
    stopSpeaking()
    synth.emitVoicesChanged()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())
    expect(synth.spoken).toHaveLength(0)
  })

  it('unwedges Chrome’s paused queue by resuming after every cancel', () => {
    const synth = stubSpeechSynthesis([voice('Microsoft Polina', 'uk-UA')])

    speak('Привіт', 'ua', 'female')
    stopSpeaking()

    expect(synth.cancelCalls).toBe(2)
    expect(synth.resumeCalls).toBe(2)
  })
})

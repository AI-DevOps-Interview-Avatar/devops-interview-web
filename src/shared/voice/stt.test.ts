import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeSpeechError, startListening } from './stt'

/**
 * Stands in for the browser's SpeechRecognition. Nothing here is async: the
 * point of these tests is that a press on the mic button resolves within the
 * same tick, so timing is driven explicitly from the test.
 */
class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = true
  maxAlternatives = 0
  onstart: (() => void) | null = null
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null
  onend: (() => void) | null = null

  stopCalls = 0
  abortCalls = 0
  /** Set before startListening() to simulate a session that is still winding down. */
  failOnStart = false

  start(): void {
    if (this.failOnStart) throw new Error('InvalidStateError')
    this.onstart?.()
  }

  stop(): void {
    this.stopCalls += 1
  }

  abort(): void {
    this.abortCalls += 1
  }

  /** Delivers one finalized transcript, the way `continuous: true` does. */
  emitFinal(transcript: string): void {
    const alternative = { transcript }
    const result = { isFinal: true, length: 1, 0: alternative, item: () => alternative }
    const results = { length: 1, 0: result, item: () => result }
    this.onresult?.({ resultIndex: 0, results } as unknown as SpeechRecognitionEvent)
  }

  emitError(error: string): void {
    this.onerror?.({ error } as SpeechRecognitionErrorEvent)
  }
}

function stubRecognition() {
  const recognition = new FakeRecognition()
  vi.stubGlobal('window', { SpeechRecognition: function () { return recognition } })
  return recognition
}

function callbacks() {
  return { onResult: vi.fn(), onEnd: vi.fn(), onStart: vi.fn(), onError: vi.fn() }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeSpeechError', () => {
  it('collapses codes that call for the same user action', () => {
    expect(normalizeSpeechError('service-not-allowed')).toBe('not-allowed')
    expect(normalizeSpeechError('not-allowed')).toBe('not-allowed')
  })

  it('falls back to a code the UI has copy for', () => {
    expect(normalizeSpeechError('bad-grammar')).toBe('unknown')
    expect(normalizeSpeechError('')).toBe('unknown')
  })
})

describe('startListening', () => {
  it('reports listening only once the recognizer actually starts', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    startListening('ua', cb)

    expect(cb.onStart).toHaveBeenCalledTimes(1)
    expect(recognition.continuous).toBe(true)
    expect(recognition.lang).toBe('uk-UA')
  })

  it('stops within the same tick, cutting the session instead of waiting on the service', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    const handle = startListening('en', cb)
    recognition.emitFinal('I ran a three node cluster')
    handle?.stop()

    // abort(), not stop(): stop() is the call that took 2-3 seconds to return.
    expect(recognition.abortCalls).toBe(1)
    expect(recognition.stopCalls).toBe(0)
    expect(cb.onResult).toHaveBeenCalledWith('I ran a three node cluster')
    expect(cb.onEnd).toHaveBeenCalledTimes(1)
  })

  it('sends the answer once even when the engine’s own onend arrives after stop()', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    const handle = startListening('en', cb)
    recognition.emitFinal('answer')
    handle?.stop()
    recognition.onend?.()

    expect(cb.onResult).toHaveBeenCalledTimes(1)
    expect(cb.onEnd).toHaveBeenCalledTimes(1)
  })

  it('stays silent on abort() — teardown must not push a transcript into a dead screen', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    const handle = startListening('ua', cb)
    recognition.emitFinal('відповідь')
    handle?.abort()
    recognition.onend?.()

    expect(recognition.abortCalls).toBe(1)
    expect(cb.onResult).not.toHaveBeenCalled()
    expect(cb.onEnd).not.toHaveBeenCalled()
  })

  it('explains why the button did nothing when start() throws', () => {
    const recognition = stubRecognition()
    recognition.failOnStart = true
    const cb = callbacks()

    const handle = startListening('ua', cb)

    expect(handle).toBeNull()
    expect(cb.onError).toHaveBeenCalledWith('busy')
  })

  it('surfaces the real cause instead of a blanket “no speech detected”', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    startListening('ua', cb)
    recognition.emitError('not-allowed')

    expect(cb.onError).toHaveBeenCalledWith('not-allowed')
    expect(cb.onEnd).toHaveBeenCalledTimes(1)
  })

  it('treats an aborted event as our own stop, not a failure to report', () => {
    const recognition = stubRecognition()
    const cb = callbacks()

    startListening('ua', cb)
    recognition.emitError('aborted')

    expect(cb.onError).not.toHaveBeenCalled()
    expect(cb.onEnd).not.toHaveBeenCalled()
  })
})

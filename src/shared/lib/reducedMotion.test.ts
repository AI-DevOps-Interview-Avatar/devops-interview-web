import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion } from './reducedMotion'

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn(() => ({ matches }) as MediaQueryList)
  vi.stubGlobal('window', { matchMedia })
  return matchMedia
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('reports the media query result', () => {
    const matchMedia = stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('is false when the user has expressed no preference', () => {
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('assumes full motion on engines without matchMedia rather than throwing', () => {
    vi.stubGlobal('window', {})
    expect(prefersReducedMotion()).toBe(false)
  })
})

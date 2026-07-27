import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the OS is asking for less motion right now.
 *
 * Defensive about `matchMedia` because this also runs under the `node` test
 * environment, where `window` exists only as far as a test stubs it.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * Reactive form of the above, for motion that CSS cannot simply switch off.
 *
 * The stylesheet neutralises animation durations wholesale, but a couple of our
 * decorations only make sense *while* they move: the orbit ring places its
 * labels through the animation itself, so a frozen ring stacks all five of them
 * on one point. Those are dropped from the tree instead of being stilled.
 *
 * The preference is external state that can flip mid-session, which is exactly
 * what `useSyncExternalStore` is for — no effect, no render cascade.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion)
}

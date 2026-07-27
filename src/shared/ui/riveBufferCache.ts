/**
 * Keeps every `.riv` payload for the lifetime of the page.
 *
 * `useRive({ src })` refetches and re-parses the file on every mount, so
 * returning to Home after an interview rebuilt all four avatars from scratch:
 * the recruiter card appeared instantly while its face arrived a beat later.
 * Holding the ArrayBuffer here means a file crosses the network at most once
 * per page session and later mounts start with the bytes already in hand.
 */
const buffers = new Map<string, ArrayBuffer>()
const inFlight = new Map<string, Promise<ArrayBuffer>>()

/** Lives here rather than next to the component so the splash screen can warm the cache without pulling in Rive itself. */
export function riveAssetUrl(riveFile: string): string {
  return `${import.meta.env.BASE_URL}avatars/${riveFile}`
}

/** The cached payload, or undefined if this file has not finished loading yet. */
export function getCachedRiveBuffer(url: string): ArrayBuffer | undefined {
  return buffers.get(url)
}

export function loadRiveBuffer(url: string): Promise<ArrayBuffer> {
  const cached = buffers.get(url)
  if (cached) return Promise.resolve(cached)

  // Four tiles mount together on Home — they share one request rather than
  // racing four identical ones.
  const pending = inFlight.get(url)
  if (pending) return pending

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Rive asset ${url} responded ${response.status}`)
      return response.arrayBuffer()
    })
    .then((buffer) => {
      buffers.set(url, buffer)
      inFlight.delete(url)
      return buffer
    })
    .catch((error: unknown) => {
      // Nothing poisoned is left behind: a later mount is free to retry.
      inFlight.delete(url)
      throw error
    })

  inFlight.set(url, request)
  return request
}

/** Drops everything held. Exists for tests — the cache is meant to live as long as the page. */
export function resetRiveBufferCache(): void {
  buffers.clear()
  inFlight.clear()
}

/**
 * Warms the cache before anything renders an avatar. Failures are ignored on
 * purpose — this is an optimization, and the tile falls back to loading its
 * own file (and to its placeholder) if the network is unhappy.
 */
export function prefetchRiveBuffers(urls: string[]): void {
  for (const url of urls) {
    void loadRiveBuffer(url).catch(() => undefined)
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCachedRiveBuffer,
  loadRiveBuffer,
  prefetchRiveBuffers,
  resetRiveBufferCache,
} from './riveBufferCache'

/** Counts requests and lets a test decide when each one resolves. */
function stubFetch({ ok = true }: { ok?: boolean } = {}) {
  const resolvers: Array<(value: Response) => void> = []
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      }),
  )
  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    /** Completes the request opened at `index`. */
    settle(index = 0, bytes = 8) {
      resolvers[index]({
        ok,
        status: ok ? 200 : 404,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
      } as Response)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetRiveBufferCache()
})

describe('loadRiveBuffer', () => {
  it('fetches a file once and serves every later caller from memory', async () => {
    const net = stubFetch()

    const first = loadRiveBuffer('/avatars/emma.riv')
    net.settle()
    await first

    await loadRiveBuffer('/avatars/emma.riv')
    await loadRiveBuffer('/avatars/emma.riv')

    expect(net.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares one request between tiles mounting at the same time', async () => {
    const net = stubFetch()

    // Four avatars on Home, all asking for the same file before it lands.
    const pending = [0, 1, 2, 3].map(() => loadRiveBuffer('/avatars/emma.riv'))
    net.settle()

    expect(net.fetchMock).toHaveBeenCalledTimes(1)
    const [first, ...rest] = await Promise.all(pending)
    expect(rest.every((buffer) => buffer === first)).toBe(true)
  })

  it('exposes the payload synchronously once cached — that is what kills the flicker', async () => {
    const net = stubFetch()

    expect(getCachedRiveBuffer('/avatars/emma.riv')).toBeUndefined()
    const pending = loadRiveBuffer('/avatars/emma.riv')
    net.settle(0, 16)
    await pending

    expect(getCachedRiveBuffer('/avatars/emma.riv')?.byteLength).toBe(16)
  })

  it('leaves nothing poisoned behind when a load fails', async () => {
    const failing = stubFetch({ ok: false })

    await expect(
      (() => {
        const pending = loadRiveBuffer('/avatars/emma.riv')
        failing.settle()
        return pending
      })(),
    ).rejects.toThrow('404')
    expect(getCachedRiveBuffer('/avatars/emma.riv')).toBeUndefined()

    // A later mount retries rather than inheriting the rejected promise.
    const retry = stubFetch()
    const pending = loadRiveBuffer('/avatars/emma.riv')
    retry.settle()

    await expect(pending).resolves.toBeInstanceOf(ArrayBuffer)
  })
})

describe('prefetchRiveBuffers', () => {
  it('opens one request per file and swallows failures', async () => {
    const net = stubFetch({ ok: false })

    prefetchRiveBuffers(['/avatars/emma.riv', '/avatars/marcus.riv'])
    net.settle(0)
    net.settle(1)
    await Promise.resolve()

    expect(net.fetchMock).toHaveBeenCalledTimes(2)
  })
})

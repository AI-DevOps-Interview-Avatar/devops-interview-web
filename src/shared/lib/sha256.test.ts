import { describe, expect, it } from 'vitest'
import { Sha256Stream, sha256Hex } from './sha256'

const encoder = new TextEncoder()

/** What `crypto.subtle.digest` says, for the cases small enough to ask it. */
async function subtleHex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('Sha256Stream', () => {
  it('matches the published vectors', () => {
    // FIPS 180-4 examples. Hardcoded rather than computed, so a bug that broke
    // both this implementation and the comparison below still fails here.
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256Hex(encoder.encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(sha256Hex(encoder.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('agrees with crypto.subtle on random input', async () => {
    for (const length of [1, 55, 56, 63, 64, 65, 127, 128, 1000]) {
      const bytes = crypto.getRandomValues(new Uint8Array(length))
      expect(sha256Hex(bytes)).toBe(await subtleHex(bytes))
    }
  })

  it('gives the same digest however the stream is cut up', async () => {
    // The property the whole module exists for: chunk boundaries come from
    // whatever the network or the disk produced, and must not reach the result.
    const bytes = crypto.getRandomValues(new Uint8Array(4096))
    const expected = await subtleHex(bytes)

    for (const size of [1, 7, 64, 100, 4096]) {
      const stream = new Sha256Stream()
      for (let at = 0; at < bytes.length; at += size) stream.update(bytes.subarray(at, at + size))
      expect(stream.digestHex()).toBe(expected)
    }
  })

  it('handles the 56-byte boundary where padding needs a second block', async () => {
    // §5.1.1: a message whose last block leaves fewer than 9 bytes free pushes
    // the length field into a block of its own. Off-by-one country.
    for (let length = 50; length <= 70; length++) {
      const bytes = crypto.getRandomValues(new Uint8Array(length))
      expect(sha256Hex(bytes)).toBe(await subtleHex(bytes))
    }
  })

  it('refuses to be reused, rather than returning a quietly wrong digest', () => {
    const stream = new Sha256Stream().update(encoder.encode('abc'))
    stream.digestHex()

    expect(() => stream.digestHex()).toThrow(/twice/)
    expect(() => stream.update(encoder.encode('more'))).toThrow(/after digest/)
  })
})

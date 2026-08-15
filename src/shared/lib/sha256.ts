/**
 * SHA-256 over a stream, because the thing being hashed is 528 MB.
 *
 * `crypto.subtle.digest()` is the right tool for everything else in a browser
 * and the wrong one here: it takes a whole buffer. Hashing the model bundle
 * with it means holding half a gigabyte of weights in a JS ArrayBuffer *and*
 * writing the same bytes to storage — on a phone that is the difference between
 * a verified download and a tab the browser kills mid-way.
 *
 * So the bytes are hashed as they go past, chunk by chunk, and nothing larger
 * than one chunk is ever resident. FIPS 180-4 §6.2, no shortcuts: this is
 * checked against `crypto.subtle` on random input in the tests, precisely
 * because a hand-rolled hash that is subtly wrong is worse than none at all —
 * it would reject good downloads and, far worse, could be made to accept bad
 * ones.
 */

// The first 32 bits of the fractional parts of the cube roots of the first 64 primes.
const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])

/** Rotate right — JS has no operator for it, and `>>>` alone loses the wrapped bits. */
function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

export class Sha256Stream {
  // The first 32 bits of the fractional parts of the square roots of the first 8 primes.
  private readonly h = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  /** Bytes that arrived since the last complete 64-byte block. */
  private readonly pending = new Uint8Array(64)
  private pendingLength = 0
  private totalBytes = 0

  private readonly w = new Uint32Array(64)
  private done = false

  /**
   * Absorbs a chunk of any length.
   *
   * Chunk boundaries are meaningless to the result — a stream split into 1-byte
   * pieces hashes the same as one buffer — which is the whole point when the
   * chunks are whatever a network or a disk read happened to produce.
   */
  update(chunk: Uint8Array): this {
    if (this.done) throw new Error('Sha256Stream: update() after digest()')

    this.totalBytes += chunk.length
    let offset = 0

    // Top up the partial block first, so the fast path below always starts aligned.
    if (this.pendingLength > 0) {
      const wanted = Math.min(64 - this.pendingLength, chunk.length)
      this.pending.set(chunk.subarray(0, wanted), this.pendingLength)
      this.pendingLength += wanted
      offset = wanted
      if (this.pendingLength < 64) return this
      this.compress(this.pending, 0)
      this.pendingLength = 0
    }

    // Whole blocks are compressed straight out of the caller's buffer: no copy,
    // which at 528 MB is the difference between one pass over the data and two.
    for (; offset + 64 <= chunk.length; offset += 64) this.compress(chunk, offset)

    if (offset < chunk.length) {
      this.pending.set(chunk.subarray(offset), 0)
      this.pendingLength = chunk.length - offset
    }

    return this
  }

  /** The digest as lowercase hex. Single use: the state is finalised by padding. */
  digestHex(): string {
    if (this.done) throw new Error('Sha256Stream: digestHex() called twice')
    this.done = true

    // §5.1.1: a 0x80 byte, zeroes, then the message length in bits as a 64-bit
    // big-endian integer, filling the block that carries it.
    const tail = new Uint8Array(this.pendingLength < 56 ? 64 : 128)
    tail.set(this.pending.subarray(0, this.pendingLength), 0)
    tail[this.pendingLength] = 0x80
    // Bits, not bytes, and 2**53 bits is 1 PB — a length this codebase will not
    // reach, so a Number is safe where the spec wants 64 bits.
    new DataView(tail.buffer).setBigUint64(tail.length - 8, BigInt(this.totalBytes) * 8n)

    for (let offset = 0; offset < tail.length; offset += 64) this.compress(tail, offset)

    let hex = ''
    for (const word of this.h) hex += word.toString(16).padStart(8, '0')
    return hex
  }

  private compress(block: Uint8Array, offset: number): void {
    const w = this.w

    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4
      w[i] = ((block[at] << 24) | (block[at + 1] << 16) | (block[at + 2] << 8) | block[at + 3]) >>> 0
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = this.h

    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + K[i] + w[i]) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    const h0 = this.h
    h0[0] = (h0[0] + a) >>> 0
    h0[1] = (h0[1] + b) >>> 0
    h0[2] = (h0[2] + c) >>> 0
    h0[3] = (h0[3] + d) >>> 0
    h0[4] = (h0[4] + e) >>> 0
    h0[5] = (h0[5] + f) >>> 0
    h0[6] = (h0[6] + g) >>> 0
    h0[7] = (h0[7] + h) >>> 0
  }
}

/** Convenience for the small inputs in tests and for callers that already hold a buffer. */
export function sha256Hex(bytes: Uint8Array): string {
  return new Sha256Stream().update(bytes).digestHex()
}

import { describe, expect, it } from 'vitest'
import {
  CSP_DIRECTIVES,
  headerPolicy,
  headersFile,
  metaPolicy,
  META_IGNORED_DIRECTIVES,
  RESPONSE_HEADERS,
} from './csp.ts'

describe('policy strength', () => {
  it('never allows arbitrary script evaluation or inline script', () => {
    for (const policy of [metaPolicy(), headerPolicy()]) {
      expect(policy).not.toMatch(/'unsafe-eval'/)
      expect(policy).not.toMatch(/'unsafe-inline'/)
    }
  })

  it("allows WASM compilation, which Rive cannot start without", () => {
    // 'wasm-unsafe-eval' permits compiling WebAssembly and nothing else — it is
    // not a back door to eval(), and this assertion exists so nobody "fixes"
    // the test above by deleting it.
    expect(metaPolicy()).toContain("script-src 'self' 'wasm-unsafe-eval'")
  })

  it('falls back to self for anything not named', () => {
    expect(metaPolicy()).toContain("default-src 'self'")
  })

  it('lets Rive decode the raster assets embedded in a .riv file', () => {
    // Regression guard. Rive turns an embedded PNG into a Blob, takes an object
    // URL and loads it through an Image, so img-src governs it. Without blob:
    // the two rigs that carry PNGs render as empty circles in production while
    // the two pure-vector ones look fine — a failure with no error attached.
    expect(CSP_DIRECTIVES['img-src']).toContain('blob:')
  })

  it('blocks plugins, framing and form submission outright', () => {
    const policy = headerPolicy()
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("form-action 'none'")
    expect(policy).toContain("base-uri 'self'")
  })

  it('names no third-party origin at all, in any directive', () => {
    // The policy used to allow unpkg.com and cdn.jsdelivr.net under connect-src,
    // because Rive fetched its WASM runtime from there. It is served from our
    // own origin now (DIA-181, `src/shared/ui/riveRuntime.ts`), so an external
    // origin reappearing anywhere in this policy means something started
    // reaching off-site — on a page that holds camera and microphone
    // permission. That is a review conversation, not a silent diff.
    for (const [directive, values] of Object.entries(CSP_DIRECTIVES)) {
      for (const value of values) {
        expect(`${directive}: ${value}`).not.toMatch(/:\/\//)
      }
    }
  })

  it('keeps connect-src to same-origin, which is what the local WASM copy buys', () => {
    expect(CSP_DIRECTIVES['connect-src']).toEqual(["'self'"])
  })
})

describe('meta vs header delivery', () => {
  it('omits directives a meta tag is required to ignore, rather than pretending they apply', () => {
    const meta = metaPolicy()
    for (const directive of META_IGNORED_DIRECTIVES) {
      expect(meta).not.toContain(directive)
    }
  })

  it('keeps frame-ancestors in the header policy, where it works', () => {
    expect(headerPolicy()).toContain("frame-ancestors 'none'")
  })

  it('serializes valueless directives without a trailing space', () => {
    expect(headerPolicy()).toMatch(/(^|; )upgrade-insecure-requests(;|$)/)
  })
})

describe('_headers file', () => {
  it('applies to every path', () => {
    expect(headersFile()).toContain('\n/*\n')
  })

  it('carries the Permissions-Policy that a meta tag cannot express at all', () => {
    const file = headersFile()
    expect(file).toContain('Permissions-Policy: microphone=(self), camera=(self)')
    expect(RESPONSE_HEADERS['Permissions-Policy']).toContain('geolocation=()')
  })

  it('indents each header under the path block, as the format requires', () => {
    for (const line of headersFile().split('\n').slice(2).filter(Boolean)) {
      expect(line).toMatch(/^ {2}\S/)
    }
  })
})

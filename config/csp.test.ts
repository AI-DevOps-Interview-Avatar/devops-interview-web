import { describe, expect, it } from 'vitest'
import {
  CSP_DIRECTIVES,
  headerPolicy,
  headersFile,
  metaPolicy,
  META_IGNORED_DIRECTIVES,
  RESPONSE_HEADERS,
  RIVE_WASM_ORIGINS,
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

  it('blocks plugins, framing and form submission outright', () => {
    const policy = headerPolicy()
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("form-action 'none'")
    expect(policy).toContain("base-uri 'self'")
  })

  it('names the Rive CDN only under connect-src, never as a script source', () => {
    for (const origin of RIVE_WASM_ORIGINS) {
      expect(CSP_DIRECTIVES['connect-src']).toContain(origin)
      expect(CSP_DIRECTIVES['script-src']).not.toContain(origin)
    }
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

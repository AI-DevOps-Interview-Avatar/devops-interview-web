/**
 * The site's Content-Security-Policy, in one place.
 *
 * Two consumers, one source: the `<meta http-equiv>` tag injected into the
 * production `index.html`, and the `_headers` file emitted alongside it for a
 * host that can actually send headers. Writing the policy twice is how the two
 * drift apart.
 *
 * Why this app needs a policy at all: it asks for the microphone and the
 * camera. A script injected into this origin — through a compromised
 * dependency, most realistically — would inherit those grants on a page the
 * user has already trusted.
 */

/**
 * Rive fetches its WebAssembly runtime from a CDN at run time rather than
 * bundling it: `https://unpkg.com/@rive-app/canvas@<version>/rive.wasm`, with
 * jsDelivr as a fallback. Both strings are in our built bundle — grep
 * `dist/assets/*.js` for `unpkg.com`.
 *
 * These two entries are the only third-party origins in the whole policy, and
 * they are here under protest: it means the interview avatars stop rendering if
 * unpkg has a bad day, and it puts a third party inside the trust boundary of a
 * page holding camera permission. Removing them means self-hosting the `.wasm`
 * and pointing `RuntimeLoader.setWasmUrl()` at it — tracked as a follow-up, see
 * docs/content-security-policy.md.
 */
export const RIVE_WASM_ORIGINS = ['https://unpkg.com', 'https://cdn.jsdelivr.net'] as const

type Directives = Record<string, readonly string[]>

export const CSP_DIRECTIVES: Directives = {
  "default-src": ["'self'"],

  // No 'unsafe-inline': Vite emits the entry as an external module script, and
  // React applies `style={{…}}` objects through the CSSOM rather than as a
  // style attribute, so neither needs it.
  //
  // 'wasm-unsafe-eval' is required for WebAssembly compilation under CSP3 and
  // is *not* 'unsafe-eval' — it permits compiling WASM and nothing else. Rive
  // cannot start without it.
  "script-src": ["'self'", "'wasm-unsafe-eval'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", 'data:'],
  "font-src": ["'self'"],

  // Same-origin covers the i18n bundles and the .riv avatar files; the two CDNs
  // are the Rive WASM fetch described above.
  "connect-src": ["'self'", ...RIVE_WASM_ORIGINS],

  // The self-camera tile attaches a MediaStream via `srcObject`, which CSP does
  // not govern — no blob: needed here.
  "media-src": ["'self'"],

  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'none'"],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": [],
}

/**
 * Directives a `<meta>`-delivered policy must ignore, per CSP Level 3 §3.3.
 *
 * Worth stating explicitly rather than quietly emitting them: `frame-ancestors`
 * is our clickjacking defence, and in the meta tag it does nothing at all. On
 * GitHub Pages the site therefore has no framing protection — see the doc.
 */
export const META_IGNORED_DIRECTIVES = ['frame-ancestors', 'report-uri', 'report-to', 'sandbox']

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ')
}

/** The policy as it goes into `<meta http-equiv="Content-Security-Policy">`. */
export function metaPolicy(): string {
  const usable = Object.fromEntries(
    Object.entries(CSP_DIRECTIVES).filter(([name]) => !META_IGNORED_DIRECTIVES.includes(name)),
  )
  return serialize(usable)
}

/** The full policy, for a host that can send a real header. */
export function headerPolicy(): string {
  return serialize(CSP_DIRECTIVES)
}

/**
 * Response headers for a host that supports them (Cloudflare Pages, Netlify,
 * or a reverse proxy). Emitted as `_headers` into the build output.
 *
 * Inert on GitHub Pages, which serves static files and nothing else — that is
 * precisely why `Permissions-Policy` cannot be delivered today. Shipping the
 * file anyway makes a hosting move a configuration change rather than a
 * security project.
 */
export const RESPONSE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': headerPolicy(),

  // The two grants this app actually uses, restricted to our own origin, and
  // an explicit denial of everything else it never asks for.
  'Permissions-Policy': 'microphone=(self), camera=(self), geolocation=(), payment=(), usb=()',

  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export function headersFile(): string {
  const lines = Object.entries(RESPONSE_HEADERS).map(([name, value]) => `  ${name}: ${value}`)
  return `# Generated from config/csp.ts — do not edit by hand.\n/*\n${lines.join('\n')}\n`
}

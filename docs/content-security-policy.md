# Content Security Policy and response headers

Reference for DIA-173. The policy itself lives in `config/csp.ts`; this explains
the reasoning and, more importantly, what the current hosting cannot deliver.

## Why this app needs one

It asks for the microphone and the camera. A script that reaches this origin —
realistically through a compromised npm dependency rather than a stored XSS,
since there is no server and no user-generated HTML — inherits those grants on a
page the candidate has already trusted, plus read access to the interview
history and candidate profile in `localStorage` (see
`local-data-retention.md`).

## How it is delivered

`config/csp.ts` is the single source. The `securityHeaders()` plugin in
`vite.config.ts` uses it twice at build time:

- injects `<meta http-equiv="Content-Security-Policy">` into `index.html`,
  immediately after `<meta charset>` and ahead of every script and stylesheet;
- emits `dist/_headers` for a host that can send real headers.

The plugin is `apply: 'build'` only. The dev server injects React Fast Refresh
as an inline script and serves CSS through inline `<style>` tags — both
forbidden by this policy. Applying it in dev would break the tooling and train
everyone to ignore console violations, so dev runs without it and the build is
the thing that must be verified.

The deploy workflow copies `index.html` to `404.html`, so deep links inherit the
policy with no extra step.

## Directives

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Everything unnamed falls back to same-origin |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Vite emits the entry as an external module script. `'wasm-unsafe-eval'` permits WebAssembly compilation and nothing else — it is **not** `'unsafe-eval'`, and Rive cannot start without it |
| `style-src` | `'self'` | CSS is extracted to a file. React applies `style={{…}}` objects through the CSSOM, not as a `style` attribute, so no `'unsafe-inline'` is needed |
| `img-src` | `'self' data:` | Same-origin favicon; `data:` for any inlined asset |
| `font-src` | `'self'` | System font stack, no webfonts |
| `connect-src` | `'self'` + two CDNs | i18n bundles and `.riv` files are same-origin; the CDNs are the Rive WASM fetch, below |
| `media-src` | `'self'` | The self-camera tile attaches a `MediaStream` via `srcObject`, which CSP does not govern |
| `object-src`, `frame-src` | `'none'` | No plugins, no iframes |
| `base-uri` | `'self'` | Stops an injected `<base>` from repointing every relative URL |
| `form-action` | `'none'` | Nothing on the site submits a form |
| `frame-ancestors` | `'none'` | Clickjacking — **header only**, see below |
| `upgrade-insecure-requests` | — | Belt and braces on an HTTPS-only host |

## The Rive CDN dependency

`@rive-app/react-canvas` does not bundle its WebAssembly runtime. It fetches it
at run time from `https://unpkg.com/@rive-app/canvas@<version>/rive.wasm`, with
jsDelivr as a fallback. Both URLs are in our production bundle — confirm with:

```bash
npm run build
grep -o "unpkg\.com[^\"']\{0,60\}" dist/assets/*.js
```

This is the only third-party origin in the entire policy, and it is a genuine
weakness rather than a formality:

- the interview avatars stop rendering whenever unpkg has a bad day;
- a third party sits inside the trust boundary of a page that holds camera and
  microphone permission.

**Follow-up worth filing:** self-host the `.wasm` (copy it out of
`node_modules/@rive-app/canvas` during the build, point
`RuntimeLoader.setWasmUrl()` at the local copy) and drop both CDNs from
`connect-src`, leaving a policy with no external origins at all. Not done here
because it changes runtime asset loading, which deserves its own ticket and its
own browser verification.

## What GitHub Pages cannot do

GitHub Pages serves static files and offers no way to set response headers.
Two consequences, both structural rather than fixable in this repository:

1. **`frame-ancestors` does nothing.** A `<meta>`-delivered policy is required
   to ignore it (CSP Level 3 §3.3), along with `report-uri`, `report-to` and
   `sandbox`. `metaPolicy()` omits them deliberately instead of emitting
   directives that quietly do nothing. The site therefore has **no framing
   protection** today.
2. **`Permissions-Policy` cannot be delivered at all.** It has no `<meta>`
   equivalent that browsers honour. The camera and microphone grants are
   consequently unrestricted at the platform level.

### The `securityheaders.com ≥ B` acceptance criterion is not achievable here

That scanner grades **response headers**. It does not parse HTML, so it will
never see the meta policy, and no amount of work inside this repository will
move the grade while the site is on GitHub Pages.

`dist/_headers` is the answer, in the Cloudflare Pages / Netlify format. It is
inert on GitHub Pages and takes effect the moment the site moves to a
header-capable host, at which point the same policy — plus `Permissions-Policy`,
`Referrer-Policy`, `X-Content-Type-Options` and `Cross-Origin-Opener-Policy` —
is served for real and the grade follows. Migrating hosting is a separate
decision and a separate ticket.

## Verifying a change to the policy

`config/csp.test.ts` covers the parts that can be asserted without a browser:
no `'unsafe-eval'` or `'unsafe-inline'` in either policy, the Rive origins
appear under `connect-src` and never under `script-src`, meta-ignored directives
are absent from the meta policy and present in the header one, and the
`_headers` file is well formed.

Everything else needs a real browser, because a CSP failure is silent to a build:

```bash
npm run build && npm run preview
```

Then, with the console open on `http://localhost:4173/devops-interview-web/`:

- no `Refused to …` violations on any route;
- avatars render on the selection screen (Rive WASM fetched and compiled);
- EN/UA switch works (i18n bundle fetched);
- an interview session speaks and accepts microphone input;
- the self-camera tile shows a picture.

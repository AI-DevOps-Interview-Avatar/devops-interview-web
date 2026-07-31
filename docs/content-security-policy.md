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
| `img-src` | `'self' data: blob:` | Same-origin favicon; `data:` for inlined assets; `blob:` for Rive's raster decode — see below |
| `font-src` | `'self'` | System font stack, no webfonts |
| `connect-src` | `'self'` | i18n bundles, `.riv` files and Rive's WASM runtime are all same-origin — see below for how the last one got there |
| `media-src` | `'self'` | The self-camera tile attaches a `MediaStream` via `srcObject`, which CSP does not govern |
| `object-src`, `frame-src` | `'none'` | No plugins, no iframes |
| `base-uri` | `'self'` | Stops an injected `<base>` from repointing every relative URL |
| `form-action` | `'none'` | Nothing on the site submits a form |
| `frame-ancestors` | `'none'` | Clickjacking — **header only**, see below |
| `upgrade-insecure-requests` | — | Belt and braces on an HTTPS-only host |

## `blob:` and the avatars that embed raster art

The first version of this policy shipped `img-src 'self' data:` and broke two of
the four avatars in production: Marcus and Olivia rendered as empty circles
while Emma and David were fine.

The split is not random. A `.riv` file may embed raster assets, and these two do
— `strings public/avatars/avatar_senior_devops.riv` shows `character.png`,
`left eyebrow.png` and PNG chunk markers; `21942-41210-lil-avatar.riv` carries
the same. The other two rigs are pure vector, so they never touch the image
path. Rive decodes an embedded image by wrapping the bytes in a `Blob`, taking
an object URL from it, and handing that to an `Image` — a load `img-src`
governs. Denied, the character simply does not draw: no exception, no fallback,
an empty canvas.

Allowing `blob:` costs nothing defensively. Only script already running on this
origin can mint a blob URL, so it grants an attacker nothing they did not
already have.

**The lesson worth keeping:** a CSP failure is invisible to `npm run build` and
to every unit test. This one reached production because the policy was verified
by reasoning rather than by opening the site. `config/csp.test.ts` now pins
`blob:` in place, but the browser checklist at the end of this document is not
optional.

## The Rive CDN dependency, and how it was removed

`@rive-app/react-canvas` does not bundle its WebAssembly runtime. Left alone it
fetches `https://unpkg.com/@rive-app/canvas@<version>/rive.wasm` on the first
`useRive()`, with `cdn.jsdelivr.net` behind it for the non-SIMD build. Those two
origins were the only third-party entries the policy ever carried, and they were
a real weakness rather than a formality: the avatars stopped rendering whenever
unpkg had a bad day, and a third party served executable code to a page holding
camera and microphone permission.

DIA-181 moved both binaries to our own origin:

- `src/shared/ui/riveRuntime.ts` imports them as
  `@rive-app/canvas/rive.wasm?url` and `…/rive_fallback.wasm?url`, so Vite emits
  each into `dist/assets/` with the Pages base path applied and the version
  following whatever npm installed — nothing to copy by hand, nothing to bump;
- `initRiveRuntime()` hands those URLs to `RuntimeLoader.setWasmUrl()` and
  `setWasmFallbackUrl()`. `main.tsx` calls it before `createRoot`, because the
  loader keeps whichever URL it had when the first instance asked for a runtime;
- `connect-src` is back to `'self'` alone, and `config/csp.test.ts` fails on any
  directive value containing `://`.

Two consequences worth knowing:

**The CDN strings are still in the bundle.** They are the loader's compiled-in
defaults, and `grep -o "unpkg\.com[^\"']\{0,60\}" dist/assets/*.js` still finds
them. That is not a leftover to clean up — it is the safety net. If
`initRiveRuntime()` ever stops running, the fetch goes to unpkg, `connect-src`
blocks it, and the console says so. Before this change the same regression would
have been invisible.

**`@rive-app/canvas` is now a direct dependency**, pinned to the exact version
`@rive-app/react-canvas` requires. A looser range would let npm nest a second
copy, and the app would instantiate one version's WebAssembly with another
version's JavaScript — a mismatch that resolves, type-checks and then simply
fails to draw. `config/riveWasm.test.ts` compares the two resolutions on every
run.

The cost is ~3.9 MB of `.wasm` in the deploy (1.9 MB each, gzipped to ~730 KB).
Only the primary binary is ever fetched on a normal machine; the fallback is
uploaded so that the architectures needing it do not have to reach a CDN either.

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
no `'unsafe-eval'` or `'unsafe-inline'` in either policy, no third-party origin
in any directive, `blob:` pinned under `img-src`, meta-ignored directives absent
from the meta policy and present in the header one, and the `_headers` file well
formed. `config/riveWasm.test.ts` covers the dependency resolution the local
WASM copy depends on.

Everything else needs a real browser, because a CSP failure is silent to a build:

```bash
npm run build && npm run preview
```

Then, with the console open on `http://localhost:4173/devops-interview-web/`:

- no `Refused to …` violations on any route;
- all four avatars render on the selection screen **and** inside a session —
  including Marcus and Olivia, the two rigs that embed PNGs;
- the Network tab shows `assets/rive-*.wasm` coming from this origin and no
  request to `unpkg.com` or `cdn.jsdelivr.net`. Blocking both hosts (DevTools →
  Network request blocking) must change nothing;
- EN/UA switch works (i18n bundle fetched);
- an interview session speaks and accepts microphone input;
- the self-camera tile shows a picture.

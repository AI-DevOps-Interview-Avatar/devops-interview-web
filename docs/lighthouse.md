# Lighthouse: what the browser makes of the build

Reference for DIA-117. The gate lives in `scripts/lighthouseGate.mjs` and runs
as `npm run lighthouse:ci`, after `npm run test:e2e` in CI.

It is the second half of DIA-117. `docs/bundle-budget.md` answers the size
half; this answers what happens once those bytes reach a browser. The offline
half stays open — it needs a model to go offline with, and that is DIA-97.

## Why both gates exist

They disagree, and that is the point. The build passes `bundle:budget`
comfortably — 201 kB gzipped against a 260 kB budget — and still scores **48/100**
on performance for the two screens that draw avatars. Bytes are not the
problem; what the main thread does with them is.

| Route | performance | accessibility | best-practices | seo |
|---|---|---|---|---|
| `/` | 48 | 100 | 100 | 100 |
| `/interview` | 48 | 100 | 100 | 100 |
| `/pipeline` | 99 | 100 | 100 | 100 |

`/pipeline` is the control: same React, same router, same i18n, no Rive. The
50-point gap is the avatars, and it is written up as **DIA-201** (Total Blocking
Time of 5.3s and 9.4s) rather than smoothed over here.

## Thresholds

| Category | Threshold | Today | Why |
|---|---|---|---|
| accessibility | 100 | 100 | Deterministic. The same build scores the same on a laptop and a loaded runner, so a drop is a real regression. |
| best-practices | 100 | 100 | Same. |
| seo | 100 | 100 | Same. Reaching 100 needed a `<meta name="description">`, added in this change. |
| performance | **40** | 48 | A timing measurement on shared hardware. |

The performance number is a **ratchet, not a target**. It sits just under
today's 48 so the avatar screens cannot get slower unnoticed while DIA-201 is
open; closing DIA-201 raises it to 90 in the same PR, which that ticket's
acceptance criteria require.

Holding performance at 90 today would mean a gate that is red on every build.
A gate people learn to re-run on red has stopped being a gate — which is the
same reasoning that put the one unfixable advisory in `auditGate.mjs`'s
allowlist instead of leaving the audit permanently failing.

## Routes

Three, deliberately. Each costs about 15 seconds of CI, and these cover the
distinct shapes the app renders: the entry point, the heaviest screen, and the
plain-content screen every other page resembles.

The meet session is not measured. It needs a live speech engine and camera
permission, so Lighthouse would be scoring the stub rather than the app — its
accessibility is covered by `e2e/lifecycle.spec.ts` instead.

## How it runs

The script starts its own `vite preview` on port 4174 — not Playwright's 4173,
because the e2e suite runs immediately before it in CI and a lingering preview
would have this gate measuring the previous build.

Chromium comes from Playwright rather than whatever `chrome-launcher` finds on
the machine. CI already installs that exact binary for the e2e suite, and a gate
silently measuring a different browser than the one we test in is worse than no
gate at all.

```bash
npm run build && npm run lighthouse:ci
```

`scripts/lighthouseGate.test.mjs` covers the checking logic without launching a
browser, including the case where a category errors and scores `null` — treated
as a failure, because a category that did not run is not a category that passed.

## Not covered here

Offline behaviour after the first model download (the third part of DIA-117) is
blocked on DIA-96/DIA-97: there is no model bundle to cache yet, and the app
runs on `MockLlmBackend`.

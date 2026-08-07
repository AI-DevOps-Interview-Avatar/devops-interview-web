# Lighthouse: what the browser makes of the build

Reference for DIA-117. The gate lives in `scripts/lighthouseGate.mjs` and runs
as `npm run lighthouse:ci`, after `npm run test:e2e` in CI.

It is the second half of DIA-117. `docs/bundle-budget.md` answers the size
half; this answers what happens once those bytes reach a browser. The offline
half stays open — it needs a model to go offline with, and that is DIA-97.

## Why both gates exist

They disagree, and that is the point. The build passes `bundle:budget`
comfortably — 201 kB gzipped against a 260 kB budget — and the two screens that
draw avatars still score 11-13 points below one that does not. Bytes are not the
problem; what the main thread does with them is.

Every number here comes from **run #40 on `ubuntu-latest`, commit `e844820`**:

| Route | performance | accessibility | best-practices | seo |
|---|---|---|---|---|
| `/` | 86 | 100 | 100 | 100 |
| `/interview` | 88 | 100 | 100 | 100 |
| `/pipeline` | 99 | 100 | 100 | 100 |

`/pipeline` is the control: same React, same router, same i18n, no Rive. The
gap is the avatars, and it is written up as **DIA-201** rather than smoothed
over here.

## Thresholds

| Category | Threshold | On CI | Enforced | Why |
|---|---|---|---|---|
| accessibility | 100 | 100 | everywhere | Deterministic. The same build scores the same on a laptop and a loaded runner, so a drop is a real regression. |
| best-practices | 100 | 100 | everywhere | Same. |
| seo | 100 | 100 | everywhere | Same. Reaching 100 needed a `<meta name="description">`. |
| performance | **80** | 86 | CI only | A timing measurement on shared hardware, so it keeps a margin — and only means anything on the runner. |

The performance number is a **ratchet, not a target**. It sits under today's 86
so the avatar screens cannot get slower unnoticed while DIA-201 is open; closing
DIA-201 raises it to 95 in the same PR, which that ticket's acceptance criteria
require.

Holding performance at 95 today would mean a gate that is red on every build.
A gate people learn to re-run on red has stopped being a gate — which is the
same reasoning that put the one unfixable advisory in `auditGate.mjs`'s
allowlist instead of leaving the audit permanently failing.

### Measure it on CI, not here

This file first shipped with 48, 48, 99 in that table and a threshold of 0.40
under them. Those were laptop numbers, taken right after a build and the e2e
suite had loaded the same machine. The runner scores 86 and 88 on that exact
commit — the difference is hardware, not the app.

It left a gate that would have watched the avatar screens fall from 86 to 45 and
stayed green, which is what DIA-202 fixed. The rule that came out of it: the
three deterministic categories can be trusted from a local run, but any
performance number that ends up in this file or in `THRESHOLDS` is read off a
CI run, and the run it came from is written down next to it.

The same spread is why `thresholdsFor()` enforces performance only when `CI` is
set. A laptop scores 50-60 on the avatar screens, so the 80 floor would be red
locally on every run — and a gate that is always red teaches people to ignore
the one time it is right. Locally the score is still printed, just without a
verdict; the script says which profile it used above the table, so a runner that
somehow lost `CI` is visible rather than silently lenient.

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

# Bundle size: what is split, and what holds it there

Reference for DIA-134. The budget lives in `scripts/bundleBudget.mjs` and runs
as `npm run bundle:budget`, right after `npm run build` in CI.

## Before

One chunk, 648 kB minified (200 kB gzipped), past Vite's 500 kB warning
threshold. Everything was in it: the Rive runtime behind the avatars, all four
question banks, the assessment rubric, the offer letter generator. A candidate
opening the splash screen downloaded and parsed the entire interview machinery
before reading a word of it.

## After

Every screen except the splash is a route-level `import()` in `src/App.tsx`:

| Chunk | gzipped | What it is |
|---|---|---|
| entry | 100 kB | React, Redux, the router, i18n, the splash screen |
| `AvatarTile-*` | 47 kB | The Rive WebAssembly loader and canvas glue |
| `shuffle-*` | 28 kB | Question and quiz banks, shared by the practice hub and a session |
| everything else | < 7 kB each | One per screen |

**15 chunks, 201 kB gzipped in total** — and 100 kB of that is all the first
paint needs. No chunk-size warning.

The splash screen deliberately stays in the entry chunk. It is the landing
route and it navigates onward by itself after about a second and a half, so
splitting it out would only add a round trip ahead of the first paint.

That same second and a half is used to warm the two chunks it leads to
(`useWarmInterviewRoutes` in `App.tsx`, on `requestIdleCallback` with a timeout
fallback for Safari). Without it the loading skeleton would flash between the
bootstrap bar and the interviewer grid — the flicker DIA-162 removed from the
avatars, one layer up.

Suspense falls back to `AppSkeleton`, the boundary already in `main.tsx` for the
i18n bundle. There is no persistent navigation shell to preserve, so a boundary
per route would buy nothing.

## The budget

| Budget | Limit | Today |
|---|---|---|
| Entry chunk, gzipped | 130 kB | 100.4 kB |
| Any single chunk, raw | 500 kB | 168 kB (`AvatarTile`) |
| All chunks, gzipped | 260 kB | 201.0 kB |

Gzipped for what users pay on the wire, raw for what their device has to parse.
The per-chunk raw limit is deliberately the same 500 kB Vite warns at, so the
two never disagree.

The total exists because a per-chunk limit alone is easy to satisfy while
achieving nothing: splitting one big chunk into three medium ones moves no bytes
off the wire.

**Raising a limit is allowed.** Doing it without a sentence saying what got
bigger and why is what the check is there to prevent.

```bash
npm run build && npm run bundle:budget
```

`scripts/bundleBudget.test.mjs` covers the checking logic, including the case
where the entry chunk cannot be found — a budget check that silently measures
nothing is worse than none.

## Not covered here

DIA-117 also asks for Lighthouse CI and an offline check. This budget answers
the size half of that ticket; Lighthouse landed separately in
`docs/lighthouse.md`, and it is worth reading next to this one — the build
passes every budget above and still scores 48/100 on performance for the screens
that draw avatars (DIA-201). Bytes and blocking are different problems.

The offline check stays open, blocked on DIA-96/DIA-97: there is no model bundle
to cache yet.

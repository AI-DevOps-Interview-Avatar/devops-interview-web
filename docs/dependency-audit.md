# Dependency advisories and the audit gate

Reference for DIA-172. The gate itself is `scripts/auditGate.mjs`, wired as
`npm run audit:ci` and run in CI before lint, tests and build.

## Why not `npm audit --audit-level=high`

That is what the ticket asked for, and it does not work here. The advisory this
project carried had **no fixed release to move to**, so the command would have
failed every build until upstream shipped one — and a gate that is red for
reasons nobody can act on gets `|| true`'d within a week.

The gate therefore takes an allowlist. Each entry names an advisory, says why it
does not reach this app, and carries a date by which someone must look again. It
fails the build on:

- any high or critical advisory that is not in the allowlist;
- an allowlist entry past its `reviewBy` date;
- an allowlist entry that no longer matches anything reported — a stale
  exemption is how the *next* finding in that package gets waved through.

Moderate and low findings are reported by `npm audit` and read by humans; they
do not stop a deploy.

## What was actually resolved

`npm audit` reported three high-severity findings:

| Package | Advisory | Outcome |
|---|---|---|
| `brace-expansion` | GHSA-mh99-v99m-4gvg (DoS via unbounded expansion) | **Fixed.** Transitive under `eslint → minimatch`; `npm audit fix` moved it to 5.0.9 with no API change |
| `react-router` | GHSA-qwww-vcr4-c8h2 (RSC mode CSRF bypass) | Allowlisted on reachability, then **withdrawn upstream** — see below |
| `react-router-dom` | — | The same advisory counted a second time, because it depends on `react-router` |

**The allowlist is empty today and `npm audit` reports nothing at any severity.**

## The react-router finding, and why the suggested fix is worse

`npm audit fix --force` proposes `react-router-dom@7.11.0`. That was tried and
reverted: **7.11.0 carries six high-severity advisories of its own** — open
redirect via backslash in `<Link>`/`useNavigate`, open redirect leading to XSS,
missing protocol validation in `RSCErrorHandler`, arbitrary constructor
injection in `deserializeErrors()`, and unauthenticated DoS via inefficient
route matching. Several of those are reachable from a plain SPA. Taking that
trade to make one line of `npm audit` output go away would have made the app
measurably less safe.

The advisory covers `7.12.0 - 8.2.0`, and `7.18.2` is the newest published
version, so there is nowhere forward to go either. We are on the newest patch.

The exemption rests on reachability: GHSA-qwww-vcr4-c8h2 is a CSRF bypass in
React Router's **RSC mode**, where an action executes before the 400 response is
sent. This app is a static SPA on GitHub Pages — no server, no React Server
Components, no server actions, no cookies and no session to forge. The
vulnerable code path is not shipped and cannot be reached.

**This stops being true the moment the app grows a server.** That is the second
thing the review date is for.

### How it ended (DIA-204)

The review date was never reached. GHSA-qwww-vcr4-c8h2's affected range was
narrowed upstream and it stopped being reported for `react-router@7.18.2` — the
very version we were already pinned to, unchanged. `npm audit` went to zero
findings, the exemption no longer matched anything, and the gate's third failure
mode took CI red until the entry was deleted.

That red build is the feature, not a fault in it. An exemption that outlives its
finding is exactly the hole the next advisory in that package walks through, and
nobody goes looking for a stale allowlist entry on their own.

## The nanoid finding (DIA-206)

GHSA-2v37-7h3g-55p8, high: a custom generator loops forever when asked for a size
of zero. Reported for `nanoid@3.3.17`, reached transitively as
`vite → postcss → nanoid`, and fixed in 3.3.18 — inside postcss's own `^3.3.11`
range, so `npm update nanoid` moved it with no change to `package.json` and none
to any direct dependency.

Two things worth recording. First, it appeared on an unchanged tree: no
dependency here moved, the advisory database did, exactly as with react-router
above. Anyone bisecting a red CI against their own diff will not find it.

Second, it was fixed rather than allowlisted even though it is hard to argue this
app is exposed — `nanoid` is a build-time dependency inside vite, never reaches
the browser bundle, and nothing in this project calls it at all, let alone with
`size: 0`. An exemption is the right tool when there is nowhere to move to. When
a patch exists inside the range already declared, taking it is cheaper than the
paragraph justifying why we did not, and it leaves no review date for someone to
inherit.

## Checking it yourself

```bash
npm audit          # the full picture, all severities
npm run audit:ci   # the gate, exactly as CI runs it
```

The gate's logic is unit-tested in `scripts/auditGate.test.mjs` — including that
a stale or expired exemption fails, which is the part that would otherwise rot
quietly.

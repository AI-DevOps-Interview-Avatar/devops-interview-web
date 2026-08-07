# Where the checks run

Reference for DIA-121. Three workflow files, one step list.

| File | Trigger | What it does |
|---|---|---|
| `checks.yml` | `workflow_call` | Every check the project has. Runs nothing by itself. |
| `ci.yml` | `pull_request` | Calls `checks.yml`. This is the gate before a merge. |
| `deploy-pages.yml` | `push` to `main` | Calls `checks.yml` with `upload-pages-artifact: true`, then deploys. |

```
npm ci → audit:ci → lint → test → build → bundle:budget → playwright install → test:e2e → lighthouse:ci
```

Each step has its own document: `dependency-audit.md`, `bundle-budget.md`,
`e2e.md`, `lighthouse.md`.

## Why this was worth a ticket

Until DIA-121 the step list existed only inside `deploy-pages.yml`, which
triggers on `push` to `main`. Every check therefore ran **after** the merge, and
the Checks tab on a pull request was empty. Two changes reached `main` with no
signal at all:

- **PR #22** merged onto a `main` that was already red on `audit:ci`. The deploy
  failed at that step, every later step was skipped, and the change did not
  reach production. Nobody noticed until someone opened the run by hand.
- **PR #24** merged with zero checks, which is what prompted the ticket.

A workflow that runs the right steps at the wrong time is not a weaker gate than
none — it is a more convincing one.

## One list, not two

`checks.yml` is a reusable workflow rather than a copy of the steps in each
caller. Two lists that must agree are exactly what produced the problem above:
the moment someone adds a step to one file, the other silently stops testing
what ships. Adding a step now means editing one file, and both triggers get it.

The only difference between the two callers is the Pages artifact, which is an
input rather than a second copy of the build. A pull request builds `dist/` to
prove it builds and then throws it away.

`ci.yml` deliberately does **not** trigger on `push` to `main`: the deploy runs
the identical workflow there, and a second copy would double the CI time of
every merge to say the same thing twice.

## Concurrency

`ci.yml` cancels superseded runs on the same branch — pushing three times to a
pull request should leave one run standing. `deploy-pages.yml` does not:
`cancel-in-progress: false` on the `pages` group, because cancelling a deploy
half-way is how a site ends up serving a partial build.

## Still open

A green run does not yet block a merge — that needs branch protection on `main`
with these checks marked required, which is **DIA-168**. Until then `ci.yml`
reports, and a human decides whether to read it.

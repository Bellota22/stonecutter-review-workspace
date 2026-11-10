# Solution notes

## Intended user and task

A marketplace operations manager has to send a weekly client report for one brand and marketplace.
The internal numbers do not reconcile with the publisher's exports, and an assistant has already
recommended expanding a promotion. The task is to investigate the week, decide what the evidence
actually supports, record that decision, and generate the client report from it — for any scope in
the bundled data, not only the reported one.

## Run, use, restart, reopen, report

Docker is the shortest path and needs no host tooling beyond Docker Compose v2:

```sh
docker compose up --build      # http://localhost:3000
```

Review state is kept in the `review-runtime` volume, so `docker compose restart` reopens the saved
decisions and `docker compose down -v` starts clean. Without Docker:

```sh
npm ci                # installs Node dependencies (next, react, pglite, tsx, typescript)
npm run setup         # creates .venv and installs pytest (Python 3.11+, stdlib-only runtime)
npm run dev           # http://localhost:3000
```

- `http://localhost:3000/` lists the seven brand/marketplace scopes. Pick one to open its review case.
- The case page shows the supported outcome first, then the week comparison, the reconciliation of every
  report held for that week, the six evidence checks, the decision form and the client report.
- Save a decision: choose **Hold** or **Expand 10%**, write the reason (10 characters minimum) and submit.
  The backend re-derives the evidence and refuses an expansion it cannot support.
- Stop the server (`Ctrl-C`, or `docker compose stop`) and start it again (`npm run dev`, or
  `docker compose start`). The scope keeps its saved decision, its version number and the audit
  events; `npm run reset` deletes only the local working copy, and in Docker
  `docker compose down -v` does the same.
- Generate the client report with the button in the last card, or
  `curl 'http://localhost:3000/api/case/report?brandId=lumen-home&marketplace=CA'`.

CLI equivalents used for verification:

```sh
npm run report -- --brand cedar-coast --json   # evidence, checks, verdict, recommendation
npm run demo                                  # human-readable summary
npm test                                      # 14 TypeScript + 7 Python checks
npm run typecheck                             # strict TypeScript, no unchecked index access
npm run format:check                          # Prettier
npm run verify                                # format:check + typecheck + test
```

## What did not reconcile, and the verified result

The weekly mart is built from `sql/select-reports.sql`. That query ranked reports only by status and
kept **every** row tied at the top, so a week with several revisions was summed as if the revisions
were different weeks; and it broke remaining ties with our own import sequence, so a re-imported stale
publication outranked the correction the publisher issued.

Publisher-verified figures, before → after (all from the bundled data):

| Scope | Before | After | Publisher current report |
| --- | --- | --- | --- |
| cedar-coast / US | 24,750 (three partial revisions added) — "growth" +217.31% | **8,400**, partial through 2026-10-02, growth **not comparable** | `US-cedar-coast-2026-09-28-g3` (8,400) |
| harbor-pantry / CA | 11,780 (g3 imported twice, plus the reissue g4) — "growth" +227.22% | **3,780**, growth **5.00%** | `CA-harbor-pantry-2026-09-28-g4` (3,780) |
| moss-trail / US | previous week 5,213 from a truncated import — "growth" +17.02% | growth **not comparable** (imported 100 of 120 declared offers) | `US-moss-trail-2026-09-21-g3` (6,300 declared) |
| lumen-home / CA | 2,800 (already correct) | **2,800**, growth **12.00%** → expansion supported | `CA-lumen-home-2026-09-28-g3` |
| lumen-home / US | 10,350 | **10,350**, growth **15.00%** → expansion supported | `US-lumen-home-2026-09-28-g3` |

The correction therefore removes two false growth claims, refuses a third because the import is
truncated, and keeps the two claims the publisher actually supports (the healthy controls).

Reproduce: `npm run report -- --brand cedar-coast --json` before and after committing `3c084d1`, or
`npm test` — `tests/precedence.test.ts` asserts one report per mart row, that the mart equals that
report's offers, and that every remaining deviation from the publisher export is explained by a
measured ingestion gap.

## Visual and interaction decisions

The first version of this interface failed the "can I see what to do?" test: a long column of
equally weighted text cards, the decision form at the bottom, and a three-step tutorial explaining
what the page should have made obvious. It was rebuilt around three rules.

- **Two steps, visible at all times.** The case is `1 Record the decision` and `2 Client report`.
  The decision card lives in a sticky right rail, so the action is never below the fold, and the
  report is rendered by the server as part of the case instead of waiting behind a button. The
  numbered badges carry the flow: no tutorial block, no tour library, no modal.
- **Numbers before prose.** Four metric tiles open the case (active subscriptions, previous week,
  week-over-week, decision) with the coverage caveat attached to each figure. The outcome is one
  banner sentence derived from the failing check, so the headline and the evidence cannot disagree.
- **Progressive disclosure instead of a wall of text.** "Where the numbers came from" and "Evidence
  checks" are collapsed disclosures with a one-glance chip (`3 reports counted as one week`,
  `1 of 6 blocking`) and open automatically only when something needs attention. The reconciliation
  table inside is the detail, not the first thing you read.

Affordances: every clickable surface has a hover state (scope rows shift and highlight, cards lift
with a shadow, buttons lift and deepen, the segmented control shows its border and shadow), a
`:focus-visible` ring for keyboard use, and `prefers-reduced-motion` disables the movement. Contrast
and hit areas were checked at 1440px and 390px wide.

## Architecture, data flow, persistence, validation boundaries

```
app/ (Next.js App Router, Node runtime)
  page.tsx, case/[brand]/[marketplace]/page.tsx   server components: openCase() + scope rail
  api/case, api/case/decision, api/case/report    route handlers: the only mutation/read API
src/server/caseService.ts    use cases: openCase, saveDecision, generateReport
src/server/reviewStore.ts    review schema + repository (case, decision, event)
src/server/db.ts             one PGlite connection, serialised work, schema migration
src/domain/policy.ts         evaluateDecision, evidenceFingerprint, POLICY
src/metrics.ts               evidence: selected snapshot per week + publisher control totals
python/reconcile.py          evidence checks and growth, stdio JSON only
sql/select-reports.sql       the correction: one publisher-current report per scope and week
```

Data flow: `raw.*` → `sql/select-reports.sql` → `marts.subscription_weekly` → `src/metrics.ts`
(selected report + declared vs imported control totals) → `python/reconcile.py` (six checks, growth
only when all pass) → `src/domain/policy.ts` (the only place that decides hold vs expand) → case
service → storage and the client report. The model provider (`src/model.ts`) is still called and its
proposal is recorded in the trace, but it cannot set the outcome or the budget.

Persistence: new tables in a `review` schema on the same local PGlite working copy
(`review.review_case`, `review.decision`, `review.event`). The bundled snapshot, the exports and the
`raw.*` definitions are untouched. Decisions are versioned and append-only; each stores the business
scope, the source report identifiers, the calculation, the reason and the limitations derived from the
evidence, plus the evidence fingerprint.

State transitions: `open → decided → needs_attention → decided`. Saving re-derives evidence, so an
unsupported expansion is refused (`PolicyViolation` → `422` with violations, nothing stored). A held
decision can always be recorded. `generateReport` returns `409 requires_attention` when the stored
fingerprint no longer matches, so an old approval is never reused.

Validation boundaries: request shape at the route handler (`400`), policy on freshly derived evidence
(`422`), evidence fitness inside `reconcile.py`, and record integrity in the database (`CHECK`
constraints on outcome, budget and status).

## Code quality and typing

- TypeScript runs in `strict` mode with `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters` and `noImplicitReturns`.
- Prettier formats the source (`npm run format`, checked by `npm run format:check`). Markdown and the
  bundled fixture are excluded on purpose: the assessment documents stay as delivered, and `data/` is a
  fixed contract that must not be reformatted.
- `src/domain/*` is pure and holds the vocabulary (outcomes, case statuses), the selection explanation,
  the evidence diff and the client report. `src/server/*` owns I/O. The SQL `CHECK` constraints are
  generated from the same vocabulary, so the schema cannot drift from the code.
- Every untrusted boundary is narrowed rather than cast: the Python bridge validates the JSON it
  receives, decision rows narrow their jsonb columns once in the store, and the API parses its body
  with small read helpers that return the problems instead of throwing.

## Tests that support these claims

- `tests/precedence.test.ts` — selection invariants across all 84 mart rows, plus the three named cases.
- `tests/test_reconciliation.py` — growth is refused for partial coverage, truncated imports and a
  missing baseline; every check is reported for the interface.
- `tests/review-case.test.ts` — decision survives stop/restart, the backend refuses an unsupported
  expansion, a publisher reissue moves the case to `needs_attention` and the old approval is not
  reused, and every rejected candidate carries its reason.
- The unchanged starter tests still pass (`tests/analyst.test.ts`, the first three Python tests).

## Limitations and unfinished work

- The truncated import (moss-trail, 100 of 120 offers) is detected and blocks the decision, but it is
  not repaired: the fixture is immutable and re-fetching from a publisher is out of scope.
- A publisher reissue is recognised by `generated_at`, `period_end` and `revision`. It does not read the
  `superseded_by` column of the exports at runtime; the exports are used as the verification source in
  tests and in the diagnostic copy, not as an application dependency.
- One review case per scope and week. No case list, comments, attachments, authentication or deployment,
  as the brief excludes them.
- `reconciliationDelta` now means "counted subscriptions minus the publisher declared total", which is
  the gap that actually matters; the starter's field was the difference against itself.
- No automated browser test: the interface was verified by loading the pages and driving the API in a
  real Next.js server, and the server-side behaviour is covered by the tests above.

## Time spent

Approximately 110 minutes of reading, investigation, implementation, tests and these notes; the
3-minute narrated video is recorded separately and is not part of this estimate.

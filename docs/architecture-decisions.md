# Technical decisions

Short record of what was chosen, what it buys, and what was rejected. Read this before the interview;
the walkthrough video only has room for the headlines.

## Stack

| Choice | Why | Rejected alternative |
| --- | --- | --- |
| **Next.js 15 (App Router) + React 19 + TypeScript** | The brief requires React + TypeScript on one of two stacks. App Router lets the server read the database and render the case directly, so there is no API hop for a page that is, in the end, a report. | Vite + FastAPI: two processes, duplicated types across Python and TypeScript, CORS, and a second thing to start in a two-hour exercise. |
| **Server Actions as the only mutation path** | The form posts, the server re-derives the evidence, saves or refuses, and revalidates. One round trip, no client cache of the decision, no `router.refresh()` choreography. This is what removed a class of bug where the UI showed nothing after a save. | Client `fetch` + local state (what the first iteration did); TanStack Query (see below). |
| **Server Components + `<Suspense>` per section** | Navigation, summary, evidence, checks, history, decision rail and report stream independently, each with its own skeleton, so a slow part never blanks the page. `ASSESSMENT_LATENCY_MS` makes the states observable for a demo. | One blocking render; route-level `loading.tsx` only. |
| **PGlite (Postgres compiled to WASM)** | Same SQL as the fixture (`window functions`, `jsonb`, `CHECK`), no database server to install, and a working copy on disk so state survives a restart. | SQLite (different SQL, the fixture is Postgres), a real Postgres container (heavier for a reviewer). |
| **Python for the reconciliation bridge** | The starter already had it, it is stdlib-only, and it keeps the eight checks in one readable file. JSON in on stdin, JSON out on stdout: one contract, no shared database handle. | Rewriting the checks in TypeScript: possible, but the delivered layer was correct and worth keeping. |
| **`pdf-lib` for the report file** | Pure JS, no browser or native binary, and the PDF is drawn from the same `ClientReport` object the page shows. | Puppeteer (200 MB + Chromium), or a DOCX renderer (removed on request). |
| **CSS with tokens, no UI kit** | 30 KB of hand-written CSS keeps the visual hierarchy deliberate (numbers first, one accent, three semantic tones) and the dependency count low. | shadcn/ui + Tailwind: a full visual rewrite with no functional gain inside the time budget. |

## Architecture

Hexagonal, in the small: a pure core, adapters around it, and one direction of dependency.

```
app/                     React Server Components, one Server Action, route handlers for the JSON API
src/domain/              pure: vocabulary, policy, candidates, evidence diff, client report
src/server/              adapters: PGlite (review + evidence), Python bridge, exports reader, PDF
sql/select-reports.sql   the selection rule, the one place where the correction lives
python/reconcile.py      the eight evidence checks
```

- **Dependency direction**: `app` → `src/server` → `src/domain`. The domain imports nothing from the
  server or the UI, which is why the policy, the rejection reasons and the report text are testable
  without a database.
- **Ports and adapters**: the evidence comes from a port shaped by `Evidence`; today the adapter is
  PGlite plus two CSV files, tomorrow it can be an HTTP source without touching the policy.
- **One read per page**: the page creates the case promise once and hands it to every section; no
  section re-queries the database.

## Patterns that earn their place

| Pattern | Where | What it solves |
| --- | --- | --- |
| **Policy as code (specification)** | `src/domain/policy.ts` | The 10% rule came from `DATA_DICTIONARY` as prose and from the starter as a prompt string. As code it can be enforced, tested and explained; the model provider can only propose. |
| **Single vocabulary** | `src/domain/vocabulary.ts` | Outcomes and case statuses are declared once and generate the database `CHECK` constraints, so schema and code cannot drift. |
| **Repository** | `src/server/reviewStore.ts` | Case, decision versions and events are the only things the app writes; the store narrows `jsonb` once at the boundary instead of letting untyped rows leak into the UI. |
| **Idempotent get-or-create** | `ensureCase` | Opening a case twice returns the same case (scope + week is the natural key), which is what makes "reopen after a restart" work without an identifier in the browser. |
| **Append-only versions** | `review.decision` | Every save is a new version with its calculation, reason, limitations and evidence fingerprint; nothing is overwritten, so history is auditable. |
| **Evidence fingerprint (optimistic concurrency)** | `evidenceFingerprint` | A decision is valid for one evidence shape. If the publication changes, the case moves to `needs_attention` and the report withholds the old approval instead of silently reusing it. |
| **Validate at the boundary** | Server Action, route handlers, Python bridge | Shape is checked where data enters (400), policy is checked on freshly derived evidence (422), and the JSON from Python is narrowed before use instead of cast. |
| **Derived document** | `reportFor` / `buildClientReport` | The report is a pure function of the stored decision plus evidence, so the page, the PDF and the JSON API cannot disagree. |
| **Progressive disclosure** | The two views | The client report opens first; the investigation lives in the Review tab. Same data, different audience. |

## Front-end decisions

- **No client state library.** The server render is the source of truth; the only client state is
  "which decision am I about to record" and the pending flag from `useActionState`. This is why the
  report updates after a save without a manual reload.
- **Two views by query string** (`?view=review`) instead of client-side tabs: links work, the back
  button works, and each view streams server-side.
- **Numbers before prose**: four metric tiles, a one-sentence verdict derived from the failing check,
  and the long evidence inside disclosures that open themselves only when something needs attention.
- **Accessibility**: real `<button>`/`<a>`/`<label>` elements, `aria-current` on tabs, `:focus-visible`
  rings, `prefers-reduced-motion`.

## What I would do next

1. Validate the ingestion at import time (a run that reports `success` with 100 of 120 rows should fail
   loudly, not wait for the reconciliation to notice).
2. Read the publisher's `superseded_by` from the exports at runtime instead of deriving supersession from
   `generated_at`, and treat the exports as the primary authority for the current publication.
3. A case list across weeks, with filters and bulk export.
4. Structured logging and a metric for "decisions blocked per reason", which is the number an operations
   lead actually wants to watch.

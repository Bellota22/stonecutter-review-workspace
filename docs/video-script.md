# Walkthrough video · script and shot list

Three minutes, English narration, recorded while using the running workspace. Read the bold quotes; the
rest are stage directions. Anything marked *(optional)* can be dropped if you are running long.

**Before recording**

```sh
docker compose down -v          # clean state: no leftover test decisions
docker compose up --build       # http://localhost:3000
```

Keep the browser at 1440 px, 100 % zoom. Open `docs/architecture.svg` in a second tab. For the first
twenty seconds you can start with `ASSESSMENT_LATENCY_MS=800 docker compose up --build` so the
per-section skeletons are visible; record the rest without it.

**Budget**: ~450 words of narration. At a normal pace that is 2 min 45 s, which leaves room to breathe.

---

## 0:00 – 0:12 · What it is

Show: the landing page, hover one scope card.

> **"This is a review workspace for a weekly marketplace report: open the week operations could not
> reconcile, see what the evidence supports, record the decision, and hand the client the report."**

## 0:12 – 0:45 · The case, and the report that opens first

Open **Cedar & Coast · US**.

> **"I land on the client report, because the report is the product. Four figures from the publisher's
> own reports: 8,400 active subscriptions, 7,800 the week before. The outcome is a hold — this week is
> only published through October 2nd, so growth is not comparable — and the next step says what to do
> about it: request the complete week. The decision controls sit beside the report, and there is a
> second tab: Review."**

## 0:45 – 1:20 · The correction, in the internal tab

Switch to **Review**, expand **Where the numbers came from**.

> **"The client never sees this tab; it is the operator's evidence. The publisher reissued this week
> three times: 8,100, 8,250, 8,400. The query that came with the starter counted all three: 24,750.
> It used a `DENSE_RANK`, which gives every tied row the same rank, so filtering rank one returned
> three rows and the weekly mart added them together. The query now uses `ROW_NUMBER` with a total
> ordering — complete first, wider coverage, then the publisher's newest publication — so exactly one
> row is selected: g3, 8,400."**

*(optional, three seconds)* Terminal: `git diff starter -- sql/select-reports.sql`.

*(optional, five seconds — the clearest beat if you have room)* Terminal: `npm run demo:ranking`. It
prints the three ranking functions over the real rows: `DENSE_RANK` keeps three rows for cedar (24,750)
and one for the others, `ROW_NUMBER` keeps exactly one (8,400).

## 1:20 – 1:50 · Enforcement, decision, report

> **"Expanding is refused by the backend, not just greyed out: the server answers 422 with the reasons,
> because the eight evidence checks run there. So I record a hold. The report is regenerated from that
> saved decision, and the same document downloads as a PDF. Decision history keeps every version with
> its figures and the fingerprint of the evidence it was pinned to."**

Show: click **Expand 10%** (blocked), type a reason, **Save decision**, switch to **Client report**, then
`Download PDF`, then **Decision history** back in Review.

## 1:50 – 2:35 · Technologies, architecture and patterns

Switch to `docs/architecture.svg`.

> **"Technically, this is Next.js App Router with React server components. The server reads the database
> directly — there is no API hop for a page — and the case streams in sections with Suspense, so a slow
> part never blanks the screen. Exactly one path mutates data: a Server Action. The form posts, the
> server re-derives the evidence, saves or refuses, and revalidates; there is no client cache of the
> decision to drift out of sync — that is what removed a bug I had where the UI showed nothing after a
> save.**
>
> **The database is PGlite, Postgres compiled to WebAssembly, so the SQL in the fixture keeps working
> with no server to install, and the working copy on disk survives a restart. The eight checks run in a
> small Python process over JSON on stdin and stdout, which is the layer the starter already had.**
>
> **The architecture is hexagonal: a pure domain — vocabulary, policy, candidate explanation, evidence
> diff, report builder — with adapters around it for PGlite, the exports and the Python bridge. The
> policy is code, not a prompt: the model provider proposes, and here it proposed 20%, and the policy
> overrode it. Review state is our own schema with append-only decision versions, and each decision
> carries a fingerprint, so when the evidence changes the case requires attention instead of reusing an
> approval. The PDF is drawn from the same object the page renders, so the screen and the file cannot
> disagree."**

## 2:35 – 2:55 · Healthy control and close

Open **Lumen Home · CA**.

> **"Lumen Home is the healthy control: both weeks complete, twelve percent verified growth, so the
> policy allows a ten percent expansion, still a draft for the brand manager. And every figure is
> verified against the publisher's export: a report the publisher never issued cannot be approved."**

---

## Decisions to name out loud (pick two or three, never all)

- One authoritative publication per scope and week, chosen by publisher precedence, not by our import
  counter.
- Growth exists only when the data is complete, reconciled and comparable; otherwise it is null.
- The policy lives in code and the model can only propose; the backend refuses what it cannot prove.
- One mutation path (Server Action), versions pinned to an evidence fingerprint.
- The report is derived from the decision, never from the screen.

## If the interviewer asks deeper

- **Why not TanStack Query?** It caches data in the browser. Here the server component *is* the data
  layer; adding a client cache would duplicate the source of truth, which is exactly the bug class the
  Server Action removed.
- **Why not shadcn/ui or Tailwind?** A full visual rewrite with no functional gain inside a two-hour
  budget; the CSS is 30 KB of tokens and the design decisions are deliberate.
- **Why not FastAPI?** Two processes, duplicated types, CORS, and a second thing for the reviewer to
  start. Python stays where it earns its place: the checks.
- **What is the weakest part?** Ingestion validation: a run that reports `success` with 100 of 120 rows
  should fail at import time, not wait for the reconciliation to notice. It is listed in the notes as
  the next step, together with reading `superseded_by` from the exports at runtime.
- **How do you know the fix is right?** `git diff starter..HEAD`, the 7-scope table, and two invariant
  tests over all 84 mart rows: one report per week, and every deviation from the export explained by a
  measured ingestion gap.

## Avoid

- Reading numbers off the screen instead of saying what they mean.
- Saying "old pipeline": the baseline is the `starter` commit.
- Showing the Review tab as if it were the client deliverable.
- Listing every pattern; name the two that solved a real problem.

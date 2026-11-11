# Walkthrough video · script and shot list

Target: three minutes, English narration, recorded while using the running workspace. The numbers below
are the ones in the bundled data; nothing needs to be typed except the decision reason.

## Before recording

```sh
docker compose down -v          # clean state, no leftover test decisions
docker compose up --build       # http://localhost:3000
```

Optional: start with `ASSESSMENT_LATENCY_MS=800 docker compose up --build` for the first twenty
seconds so the per-section skeletons are visible, then record the rest without it. Keep the browser at
1440 px wide and at 100 % zoom, and have `docs/architecture.svg` open in a second tab.

## 0:00 – 0:15 · What this is

> "I built a review workspace for the weekly marketplace report. One screen: open the week operations
> could not reconcile, see what the evidence supports, record the decision, and hand over the client
> report."

Show: the landing page with the seven scopes, hover a card.

## 0:15 – 0:50 · The case, and the report that opens first

Open **Cedar & Coast · US**. The case opens on the **Client report** tab, because the report is the
product; the evidence sits behind the second tab.

> "This is the reported case, and I land on the report itself. Four figures, straight from the
> publisher's reports: 8,400 active subscriptions, 7,800 the week before. The verdict is a hold — this
> week is only published through October 2nd, so week-over-week growth is not comparable — and the
> next step says what to do about it: request the complete week."

Show: the metric figures inside the report, the caveats, the next step, the `Download draft PDF`
button. Note that there is a second tab called **Review**.

## 0:50 – 1:25 · The evidence behind it (internal view)

Switch to **Review**.

> "The client never sees this tab; it is the operator's evidence. The publisher reissued this week
> three times: g1, g2, g3 — 8,100, 8,250, 8,400. The query that came with the starter counted all
> three: 24,750. The query now counts exactly one, and the publisher's export decides which: g3, 8,400.
> The rule is: complete beats partial, wider coverage wins, and the publisher's newest publication
> supersedes the older ones — not our import counter, which is what let a re-import beat the published
> correction."

Optional stronger beat: in a terminal, `git diff starter -- sql/select-reports.sql`.

Show: the 24,750 → 8,400 strip, the table with Period, Export, Our import and the short reasons, then
the checks card open with the failing coverage check and the eight measurements.

## 1:25 – 1:55 · Backend enforcement, decision, report

> "Because the evidence is incomplete, expanding is refused by the backend, not just greyed out: the
> server answers 422 with the reasons. So I record a hold. The client report is generated from that
> saved decision — 8,400, 7,800, not comparable, with the caveats and the next step — and the same
> document downloads as a PDF. Decision history keeps every version with its figures and the evidence
> fingerprint it was pinned to."

Show: click **Expand 10%** (disabled), type a reason, **Save decision**, then switch to **Client
report** and see the draft become the real report, `Download PDF`, and **Decision history** back in the
review tab.

## 1:55 – 2:35 · Architecture

Switch to `docs/architecture.svg` (or the Mermaid version in `docs/architecture.md`).

> "Here is the architecture, in four bands. Inputs are read-only: the bundled snapshot and the publisher
> exports. Then the pipeline: raw tables, one selection query, the weekly mart, and the evidence object.
> Validation and policy are separate on purpose: eight named checks decide whether growth even exists,
> and the policy decides the outcome. The model provider sits beside them with a dashed line — it
> proposes, it never authorizes; that 20 % suggestion came from an operational note and the policy
> overrode it. Finally the review case: versioned decisions in our own tables, saved through a Server
> Action, with a fingerprint that invalidates an approval when the data changes."

## 2:35 – 2:55 · Healthy control and close

Open **Lumen Home · CA**.

> "Lumen Home is the healthy control: both weeks complete, 12 % verified growth, so the policy allows a
> 10 % expansion — still a draft for the brand manager. And everything is verified against the publisher
> exports: a report the publisher never issued cannot be approved."

## Decisions to name out loud (pick two or three, do not list them all)

- One authoritative publication per scope and week, chosen by publisher precedence, not by our import
  counter.
- Growth only exists when the data is complete, reconciled and comparable; otherwise it is null.
- The policy lives in code and the model can only propose; the backend refuses what it cannot prove.
- Decisions are versioned, owned by the server and pinned to an evidence fingerprint.
- The report is derived from the decision, never from the screen, and the PDF is the same object.

## Avoid

- Reading numbers off the screen instead of explaining what they mean.
- Mentioning an "old pipeline": the baseline is the `starter` commit, and `git diff starter..HEAD`
  shows it.
- Showing the review tab as if it were the client deliverable: the client receives the report tab or
  the PDF, never the reconciliation table.

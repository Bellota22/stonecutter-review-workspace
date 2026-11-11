# Architecture

The same picture as `architecture.svg`, in Mermaid so it renders on the repository page and stays
easy to edit.

```mermaid
flowchart LR
  subgraph IN["1 - Inputs, read-only"]
    direction TB
    SNAP["data/marketplace.pglite<br/>PGlite snapshot"]
    EXP["data/exports/*.csv<br/>publisher source of record"]
    POL["Policy from DATA_DICTIONARY<br/>10% growth or more allows a 10% expansion"]
  end

  subgraph PIPE["2 - Pipeline and evidence"]
    direction LR
    RAW["raw.subscription_reports<br/>publications and control totals"]
    SEL["sql/select-reports.sql<br/>one publication per week"]
    MART["marts.subscription_weekly<br/>one row per scope and week"]
    EVI["src/metrics.ts<br/>selected report, declared vs imported, export"]
    RAW --> SEL --> MART --> EVI
  end

  subgraph VAL["3 - Validation and policy"]
    direction LR
    CHK["python/reconcile.py<br/>8 named checks"]
    VER["src/domain/policy.ts<br/>expand 10% or hold"]
    MOD["src/model.ts<br/>deterministic proposal"]
    CHK --> VER
    MOD -.->|"cannot authorize"| VER
  end

  subgraph OUT["4 - Review case and outputs"]
    direction LR
    ACT["Server Action<br/>save and revalidate"]
    SVC["src/server/caseService.ts"]
    DB[("review schema<br/>case, versions, events")]
    PAGE["Page, streamed sections"]
    PDF["PDF, same object"]
    API["JSON API"]
    ACT --> SVC
    SVC --> DB
    SVC --> PAGE
    SVC --> PDF
    SVC --> API
  end

  SNAP --> RAW
  EXP --> EVI
  POL --> VER
  EVI --> CHK
  VER --> ACT
```

Case lifecycle:

```mermaid
stateDiagram-v2
  [*] --> open
  open --> decided: decision saved
  decided --> decided: new version recorded
  decided --> needs_attention: evidence fingerprint changed
  needs_attention --> decided: revalidated and saved
```

Two boundaries matter when reading the diagram:

- Everything in bands 2 and 3 runs on the server only; the browser never sees SQL, the database or the
  Python process. The model provider is inside that boundary too, and it can only propose.
- A decision is pinned to an evidence fingerprint. When the publication the decision was taken on
  changes, the case moves to `needs_attention` and the report withholds the old approval.

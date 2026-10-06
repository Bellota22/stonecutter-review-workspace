# Stonecutter: Engineering Assessment

Senior Software Engineer, AI & Data Platform

## Your task

An operations manager is preparing a weekly client report. The supplied analyst reports strong subscription growth for Cedar & Coast and recommends expanding a promotion. Operations cannot reconcile those figures with the source reports.

Build one complete operational review workflow: open a review case, investigate the evidence, validate a correction, save the review decision and generate the corrected client report. Use the supplied application and data. Make at least one verifiable correctness improvement that supports your workflow.

## What you must build

A working visual artifact is required to operate the review. It must do more than fetch and display backend data. A generated report, read-only dashboard, CLI/JSON response, screenshot or mockup alone does not complete the assignment.

Build the artifact as a React + TypeScript application in one of these two stacks:

- Next.js (App Router), using its route handlers or server actions as the backend; or
- a Vite + React frontend that calls a FastAPI (Python) backend.

A static or hand-written HTML/JavaScript page does not satisfy the requirement, even when a backend serves it. Within either stack you choose the component structure, styling, libraries, storage approach and what the user sees. Deciding what to present, and how, is part of the assessment.

## Required operation

1. Open or create a review case for any brand and marketplace in the bundled data for the reporting period. Investigate the source evidence, show the user the inconsistencies you detect between the internal pipeline and the authoritative sources, and validate at least one correctness improvement.
2. Save a review decision with its business scope, source identifiers, calculation/result, reason and relevant limitations. The saved state must be owned by your backend/storage layer and survive stopping and restarting the solution; the user must be able to reopen the case.
3. Block approval of unsupported growth claims or promotion changes when evidence is incomplete or inconsistent. Enforce this in the backend, not only through disabled UI controls. A held or blocked decision may still be saved and produce a client report that explains the limitation and next action.
4. Generate the client report from the validated review state and evidence. Show the supported result, decision and next step. If evidence changes, revalidate or explicitly mark the review as requiring attention; do not silently reuse an old approval or hardcoded figures.

Implement one complete path that works for any brand and marketplace in the data; you do not need separate screens per case. Add meaningful checks for persistence/reopening, a rejected unsupported decision and a relevant changed-input case. Include a healthy control where appropriate. You do not need a general case-management platform, ingestion service, authentication or deployment.

The user must be able to enter the workflow, understand its evidence and limitations, and reach a useful outcome. If you provide controls, their behavior must be clear. A changed selection should produce an understandable transition; loading, empty, error and insufficient-evidence states should explain what is happening and what to do next.

We evaluate information hierarchy, scanability, readable comparisons, spacing, control behavior and recovery, as well as correct figures. A visually plausible screen with unsupported conclusions is not a strong solution. Correct numbers presented through a confusing workflow are not a complete solution either.

Keep the scope focused. You do not need a production application, authentication, deployment or a correction for every defect. Extending the starter is sufficient, and you do not need to modify every language. A focused partial solution is valid when you clearly explain what works and what remains unfinished.

## Time and tools

Spend no more than 120 minutes total, including reading, installation, investigation, building, tests, notes and recording. Stop at the limit and report actual time spent.

AI coding tools are allowed. You are responsible for checking results and explaining your submitted implementation. A real LLM is not required. After dependency installation, the workflow must run locally without paid services, external API keys, cloud accounts or deployment.

## Source rules

Publisher exports are authoritative. Internal documentation may be out of date. Keep the bundled database snapshot, publisher exports and raw table definitions unchanged. Views, marts, SQL, application code and tests may change. Add review state and derived results in separate tables or a separate local store; document their ownership and lifecycle. Browser-only transient state is not evidence of backend persistence. Tests may use isolated copies to exercise changed evidence without editing the supplied inputs.

We may check relevant behavior against a different dataset with the same schema and business contracts. Do not hardcode demonstration figures or IDs. Document your chosen scope and interfaces so reviewers can reproduce your claims.

Treat the deterministic model in src/model.ts as a third-party provider. You may change how its output is used and validated.

## Get running

Install Node.js 22 or 24 LTS with npm and Python 3.11+ with venv/pip. Extract 02 - Starter Project.zip and open a terminal inside engineering-assessment. Internet is needed for the initial dependency installation. The starter has been verified on macOS; Windows and Linux have not been tested.

```sh
npm ci
npm run setup
npm run demo
npm test
```

Setup creates a local Python environment and installs pytest. No activation is needed. The starter has a command-line interface and no frontend; creating the React + TypeScript application is part of your task. Read README.md for the project map and investigation commands.

The reporting clock is fixed at 6 October 2026, 12:00 UTC. The requested week is 28 September–4 October 2026, compared with the preceding week. The data is synthetic and spans US and CA marketplaces in USD. Your computer's date does not change the scenario.

If installation blocks you, contact the sender with the exact command, error and time spent. Do not spend beyond the time limit troubleshooting setup.

## What to submit

1. An accessible Git repository containing the working visual review operation, source, bundled data and meaningful tests. Preserve the starter history and commit your changes. Exclude installed dependencies, runtime copies and local environments. Provide exact instructions to run, use, stop, restart and reopen the saved case, and to generate its client report.
2. Concise SOLUTION.md notes: intended user and task; the inconsistencies you detected and how the app surfaces them; verified before/after result and supporting checks; information hierarchy and interaction choices; loading, empty and error behavior; architecture, data flow, persistence and state transitions; validation boundaries; tradeoffs, limitations, unfinished work and actual time spent.
3. A narrated video in English of no more than 3 minutes. Start by using the operation: open a case, show the inconsistencies the app detects, save its decision and show the generated report. Then explain one correction and its design/technical decision. A camera, editing and introductory video are not required.

Submit the repository and video links through the channel and by the deadline given by the sender. Arrange reviewer access if your links are private.

## How we evaluate

- Usefulness and scope (20 points): a complete case-to-decision-to-client-report operation within a clear scope.
- Data correctness (20 points): a verified correction, traceable figures and honest uncertainty.
- Backend reliability (20 points): coherent architecture, persistent state and contracts, enforced decision transitions, failure handling and meaningful regression evidence.
- Visual and interaction design (30 points): what you chose to present and why, hierarchy and scanability, readable controls and comparisons, consistent state transitions, useful recovery and the construction of the React + TypeScript frontend.
- Evidence and communication (10 points): reproducible instructions, concise reasoning and an actual-use demonstration.

Reviewers will use the artifact, inspect the implementation and check relevant behavior. The choice between the two permitted stacks, feature count, visual decoration and test pass rate alone do not determine the result. Frontend and backend source matter alongside what the user sees.

We evaluate your submission from the repository, SOLUTION.md and video alone. No additional take-home work is required.

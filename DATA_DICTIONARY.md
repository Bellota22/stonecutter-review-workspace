# Data and business contracts

These are the conventions of this synthetic exercise, not a complete description of Amazon APIs.
Dates use ISO format. Timestamps are UTC. The fixed evaluation time is in `src/database.ts`.
The fixture covers five brands in seven brand/marketplace scopes (US and CA), 60 products per
brand, twelve subscription weeks, eight sales weeks and seven inventory snapshots.
`data/manifest.json` lists record counts and a logical source-data fingerprint. The database
contains no customer identities.

## Tables and grain

| Table | One row represents | Identity / relationship |
|---|---|---|
| `brands` | A fictional brand | `brand_id` |
| `products` | A product in a brand | `(brand_id, asin)`; one SKU per product here |
| `raw.subscription_reports` | One imported weekly report | `report_id`; scope is brand + marketplace + period_start; `publisher_report_id` links to the exports |
| `raw.subscription_offers` | One product offer in one report | `(report_id, offer_id)`; many offers can share an ASIN |
| `raw.sales_daily` | A product's sales on a business date | brand + marketplace + date + ASIN |
| `raw.advertising_daily` | Brand advertising performance on a date | brand + marketplace + date |
| `raw.inventory_snapshots` | Product inventory on one date | brand + marketplace + date + ASIN |
| `ingestion_runs` | One report import attempt | `run_id`; `report_id` identifies the imported report |
| `marts.subscription_weekly` | Processed subscription snapshot per week | brand + marketplace + period_start |

## Subscription reports

A week starts Monday and ends Sunday. A report is a snapshot, not an increment.
Publishers can issue several reports for the same week. Reports marked `complete` cover
the full week; `partial` reports cover through their `period_end`. Within a scope, a complete
report takes precedence over partial reports. Within the same status, the greatest
`period_end` takes precedence, then greatest `revision`. Only reports extracted by the
evaluation timestamp are available for the report being prepared.

Each report is a self-contained set of offers. Within the selected report, distinct
`offer_id` values are additive, including offers for the same ASIN or with equal counts.
Offer identifiers are stable within a brand/marketplace across revisions. Counts are
nonnegative. An active subscription count is a snapshot of product-offer enrollments;
it is **not** unique customers, weekly order volume, or the sum of daily snapshots.

Columns of `raw.subscription_reports`: `revision` is a sequence number assigned by our import
job within a scope. `publisher_report_id` is the publisher's identifier for the report and
`generated_at` is when the publisher generated it. `declared_offer_count` and
`declared_active_subscriptions` are the control totals from the publisher's report header.

`extracted_at` tells when a report was obtained. `expected_period_end` is the business
coverage requested by the import. `finished_at` is job execution time. An import's
`success` status records successful fetching/storage; it is not a certification of
the report's fitness for a business decision. `rows_loaded` counts offer records.

## Publisher exports

`data/exports/` contains the publisher's records, downloaded by Operations, for every report it
published up to the evaluation time. They are independent of our ingestion.

| File | One row represents | Columns |
|---|---|---|
| `subscription_reports.csv` | A report as published | `publisher_report_id`, `brand_id`, `marketplace`, `period_start`, `period_end`, `status`, `generated_at`, `superseded_by` (blank when current), `offer_count`, `active_subscriptions` |
| `subscription_offers.csv` | One offer in a published report | `publisher_report_id`, `offer_id`, `asin`, `active_subscriptions` |

## Reporting and recommendation policy

The requested period and preceding week must have complete, comparable snapshots for
the same brand and marketplace before making a growth-based promotion recommendation.
The current import should be no older than 48 hours at the evaluation timestamp.
Missing data is unknown, not zero. The current snapshot can still be shown when incomplete,
provided its period and limitation are stated; do not present it as comparable weekly growth.
Percentage change is undefined when the preceding count is zero or unavailable.

For this exercise only, a complete comparable increase of at least 10% supports a
**10% promotion expansion suggestion**. Otherwise hold the promotion and explain the
limitation or observed result. Every suggestion remains a draft for human review.
The system must communicate material evidence limitations. Operational notes supply
campaign context; the policy here defines authorized application behavior.

Sales, advertising and inventory provide supporting context; you do not need to implement
a financial forecast or inventory optimizer. These tables are internally complete for
their documented dates. The subscription snapshots drive the promotion policy above.

## Financial definitions

All amounts are USD at two decimal places. `product_revenue` is gross sales before
promotions and refunds. `promotions` and `refunds` are stored as nonpositive adjustments.
**Net sales = product_revenue + promotions + refunds**, summed over the requested scope.
Advertising attributed sales are separate from total sales and may overlap them; do not
add the two. **ROAS = sum(attributed_sales) / sum(spend)** for the same brand, marketplace
and dates. ROAS is undefined when spend is zero. The fixture assumes a consistent
attribution convention; reconciling real-world attribution lag is outside this exercise.
Inventory uses the latest available snapshot on or before the period end for that scope.

## Local database

`marketplace.pglite` is a gzip-compressed PGlite data-directory export, not SQLite.
Use the CLI's `query` command or import `openDatabase()` to explore PostgreSQL directly.
`openDatabase(true)` creates an isolated in-memory copy, useful for tests. The working
copy persists under `.runtime/`; use one CLI process at a time. SQL files are editable.
The report command recomputes `marts.subscription_weekly`; source tables remain available
for investigation. All recommendations are textual; there are no external action tools.

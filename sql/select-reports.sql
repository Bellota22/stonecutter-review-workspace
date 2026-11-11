-- Report selection for the weekly mart: exactly one authoritative snapshot per scope and week.
--
-- Precedence follows the publisher, not our ingestion:
--   1. a complete report beats a partial one (full-week coverage),
--   2. wider coverage (greater period_end) beats narrower coverage,
--   3. the publisher's newest publication (generated_at) supersedes older ones,
--   4. our import sequence (revision) only breaks ties between re-imports of the same publication,
--   5. extracted_at/report_id keep the ordering total and reproducible.
--
--
-- Why ROW_NUMBER and not DENSE_RANK (what the starter used): DENSE_RANK gives every row in the best
-- status the same number, so `WHERE priority = 1` returned all of them and the mart added three
-- publications of one week together. ROW_NUMBER numbers 1..n inside the partition, so exactly one row
-- can be 1. Its ORDER BY must be a total order or the choice would not be reproducible, which is why
-- the last two keys exist: they only decide when every business key ties (two imports of the same
-- publication).
--
-- Step 3 is the correction: `revision` is assigned by our import job, so ordering by it lets a
-- re-imported stale publication outrank the issued correction. Only the publisher can supersede a
-- report, and it does so by publishing a newer one for the same scope and week.
WITH ranked AS (
  SELECT r.*, ROW_NUMBER() OVER (
    PARTITION BY brand_id, marketplace, period_start
    ORDER BY (status = 'complete') DESC,
             period_end DESC,
             generated_at DESC,
             revision DESC,
             extracted_at DESC,
             report_id DESC
  ) AS priority
  FROM raw.subscription_reports r
  WHERE extracted_at <= $1::timestamptz
)
SELECT * FROM ranked WHERE priority = 1

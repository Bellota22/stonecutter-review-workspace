WITH ranked AS (
  SELECT r.*, DENSE_RANK() OVER (
    PARTITION BY brand_id, marketplace, period_start
    ORDER BY CASE WHEN status = 'complete' THEN 0 ELSE 1 END
  ) AS priority
  FROM raw.subscription_reports r
  WHERE extracted_at <= $1::timestamptz
)
SELECT * FROM ranked WHERE priority = 1

CREATE SCHEMA raw;
CREATE SCHEMA marts;
CREATE TABLE brands (brand_id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE products (
  brand_id text REFERENCES brands, asin text NOT NULL, sku text NOT NULL,
  name text NOT NULL, PRIMARY KEY (brand_id, asin)
);
CREATE TABLE raw.subscription_reports (
  report_id text PRIMARY KEY, brand_id text REFERENCES brands,
  marketplace text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  revision integer NOT NULL, status text NOT NULL CHECK (status IN ('partial','complete')),
  extracted_at timestamptz NOT NULL,
  publisher_report_id text NOT NULL, generated_at timestamptz NOT NULL,
  declared_offer_count integer NOT NULL CHECK (declared_offer_count >= 0),
  declared_active_subscriptions integer NOT NULL CHECK (declared_active_subscriptions >= 0),
  UNIQUE (brand_id, marketplace, period_start, revision)
);
CREATE TABLE raw.subscription_offers (
  report_id text REFERENCES raw.subscription_reports, offer_id text NOT NULL,
  asin text NOT NULL, active_subscriptions integer NOT NULL CHECK (active_subscriptions >= 0),
  PRIMARY KEY (report_id, offer_id)
);
CREATE TABLE raw.sales_daily (
  brand_id text REFERENCES brands, marketplace text NOT NULL, date date NOT NULL,
  asin text NOT NULL, orders integer NOT NULL, units integer NOT NULL,
  product_revenue numeric(14,2) NOT NULL, promotions numeric(14,2) NOT NULL,
  refunds numeric(14,2) NOT NULL, PRIMARY KEY (brand_id, marketplace, date, asin)
);
CREATE TABLE raw.advertising_daily (
  brand_id text REFERENCES brands, marketplace text NOT NULL, date date NOT NULL,
  spend numeric(14,2) NOT NULL, attributed_sales numeric(14,2) NOT NULL,
  PRIMARY KEY (brand_id, marketplace, date)
);
CREATE TABLE raw.inventory_snapshots (
  brand_id text REFERENCES brands, marketplace text NOT NULL, date date NOT NULL,
  asin text NOT NULL, available_units integer NOT NULL,
  PRIMARY KEY (brand_id, marketplace, date, asin)
);
CREATE TABLE ingestion_runs (
  run_id text PRIMARY KEY, report_id text REFERENCES raw.subscription_reports,
  expected_period_end date NOT NULL, finished_at timestamptz NOT NULL,
  status text NOT NULL, rows_loaded integer NOT NULL
);
CREATE TABLE marts.subscription_weekly (
  brand_id text NOT NULL, marketplace text NOT NULL, period_start date NOT NULL,
  active_subscriptions bigint NOT NULL, source_period_end date NOT NULL,
  source_complete boolean NOT NULL, source_report_ids jsonb NOT NULL,
  ingested_at timestamptz NOT NULL, PRIMARY KEY (brand_id, marketplace, period_start)
);

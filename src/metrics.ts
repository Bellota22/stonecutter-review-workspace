import type { PGlite } from '@electric-sql/pglite';
import { AS_OF, PERIOD_START, PERIOD_END, PREVIOUS_START, queryRows } from './database.ts';
import type { Evidence, SourceReport } from './types.ts';
import { exportFor } from './server/publisherExports.ts';

/** Evidence for one scope: the selected snapshot per week, its publisher control totals and context. */
export const SNAPSHOT_SQL = `
SELECT w.active_subscriptions::integer AS mart_subscriptions,
       r.report_id, r.publisher_report_id, r.status, r.period_start::text AS period_start,
       r.period_end::text AS period_end, r.generated_at::text AS generated_at,
       r.extracted_at::text AS extracted_at,
       r.declared_offer_count::integer AS declared_offer_count,
       r.declared_active_subscriptions::integer AS declared_subscriptions,
       (SELECT count(*)::integer FROM raw.subscription_offers o WHERE o.report_id = r.report_id) AS loaded_offers,
       (SELECT coalesce(sum(o.active_subscriptions), 0)::integer FROM raw.subscription_offers o WHERE o.report_id = r.report_id) AS loaded_subscriptions
FROM marts.subscription_weekly w
JOIN raw.subscription_reports r ON r.report_id = (w.source_report_ids->>0)
WHERE w.brand_id = $1 AND w.marketplace = $2 AND w.period_start = $3::date`;

const SALES_SQL = `SELECT COALESCE(SUM(product_revenue + promotions + refunds), 0)::text AS total
  FROM raw.sales_daily WHERE brand_id = $1 AND marketplace = $2 AND date BETWEEN $3::date AND $4::date`;
const ADS_SQL = `SELECT COALESCE(SUM(spend), 0)::text AS spend, COALESCE(SUM(attributed_sales), 0)::text AS sales
  FROM raw.advertising_daily WHERE brand_id = $1 AND marketplace = $2 AND date BETWEEN $3::date AND $4::date`;
const INVENTORY_SQL = `SELECT COALESCE(SUM(available_units), 0)::text AS units
  FROM raw.inventory_snapshots WHERE brand_id = $1 AND marketplace = $2
    AND date = (SELECT MAX(date) FROM raw.inventory_snapshots WHERE brand_id = $1 AND marketplace = $2 AND date <= $3::date)`;

interface SnapshotRow {
  mart_subscriptions: number;
  report_id: string;
  publisher_report_id: string;
  status: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  extracted_at: string;
  declared_offer_count: number;
  declared_subscriptions: number;
  loaded_offers: number;
  loaded_subscriptions: number;
}

export interface CandidateReport extends SourceReport {
  selected: boolean;
}

function toSourceReport(row: SnapshotRow): SourceReport {
  return {
    reportId: row.report_id,
    publisherReportId: row.publisher_report_id,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    generatedAt: row.generated_at,
    extractedAt: row.extracted_at,
    declaredOfferCount: row.declared_offer_count,
    declaredSubscriptions: row.declared_subscriptions,
    loadedOffers: row.loaded_offers,
    loadedSubscriptions: row.loaded_subscriptions,
  };
}

/** The report the mart counted for one week, with the publisher totals used to verify it. */
async function loadSnapshot(
  db: PGlite,
  brandId: string,
  marketplace: string,
  periodStart: string,
): Promise<SnapshotRow | null> {
  const [row] = await queryRows<SnapshotRow>(db, SNAPSHOT_SQL, [brandId, marketplace, periodStart]);
  return row ?? null;
}

interface ContextTotals {
  netSales: number;
  adSpend: number;
  attributedAdSales: number;
  inventoryUnits: number;
}

async function loadContext(db: PGlite, brandId: string, marketplace: string): Promise<ContextTotals> {
  const [sales] = await queryRows<{ total: string }>(db, SALES_SQL, [
    brandId,
    marketplace,
    PERIOD_START,
    PERIOD_END,
  ]);
  const [ads] = await queryRows<{ spend: string; sales: string }>(db, ADS_SQL, [
    brandId,
    marketplace,
    PERIOD_START,
    PERIOD_END,
  ]);
  const [inventory] = await queryRows<{ units: string }>(db, INVENTORY_SQL, [
    brandId,
    marketplace,
    PERIOD_END,
  ]);
  return {
    netSales: Number(sales?.total ?? 0),
    adSpend: Number(ads?.spend ?? 0),
    attributedAdSales: Number(ads?.sales ?? 0),
    inventoryUnits: Number(inventory?.units ?? 0),
  };
}

export async function getEvidence(db: PGlite, brandId: string, marketplace = 'US'): Promise<Evidence> {
  const [brand] = await queryRows<{ name: string }>(db, 'SELECT name FROM brands WHERE brand_id = $1', [
    brandId,
  ]);
  if (!brand) throw new Error(`Unknown brand: ${brandId}. Query SELECT * FROM brands to see valid IDs.`);

  const current = await loadSnapshot(db, brandId, marketplace, PERIOD_START);
  const previous = await loadSnapshot(db, brandId, marketplace, PREVIOUS_START);
  const context = await loadContext(db, brandId, marketplace);
  const currentReport = current ? toSourceReport(current) : null;
  const previousReport = previous ? toSourceReport(previous) : null;

  const [currentExport, previousExport] = await Promise.all([
    exportFor(brandId, marketplace, PERIOD_START),
    exportFor(brandId, marketplace, PREVIOUS_START),
  ]);

  return {
    brandId,
    brandName: brand.name,
    marketplace,
    periodStart: PERIOD_START,
    expectedPeriodEnd: PERIOD_END,
    asOf: AS_OF,
    activeSubscriptions: current?.mart_subscriptions ?? null,
    previousSubscriptions: previous?.mart_subscriptions ?? null,
    growthPct: null,
    sourceSnapshots: current
      ? [{ reportId: current.report_id, activeSubscriptions: current.loaded_subscriptions }]
      : [],
    sourcePeriodEnd: current?.period_end ?? null,
    sourceComplete: current?.status === 'complete',
    sourceReports: current ? [current.report_id] : [],
    ingestedAt: current?.extracted_at ?? null,
    previousSourceComplete: previous?.status === 'complete',
    previousSourcePeriodEnd: previous?.period_end ?? null,
    netSales: context.netSales,
    adSpend: context.adSpend,
    attributedAdSales: context.attributedAdSales,
    roas: context.adSpend > 0 ? Math.round((context.attributedAdSales / context.adSpend) * 100) / 100 : null,
    inventoryUnits: context.inventoryUnits,
    currentReport,
    previousReport,
    currentExport,
    previousExport,
  };
}

/**
 * Every report we hold for a scope and week, with the selected one flagged.
 * The selection itself lives in sql/select-reports.sql; this read exists to explain it.
 */
export async function listCandidates(
  db: PGlite,
  brandId: string,
  marketplace: string,
  periodStart: string,
): Promise<CandidateReport[]> {
  const rows = await queryRows<SnapshotRow & { selected: boolean }>(
    db,
    `
    SELECT r.report_id, r.publisher_report_id, r.status, r.period_start::text AS period_start,
           r.period_end::text AS period_end, r.generated_at::text AS generated_at,
           r.extracted_at::text AS extracted_at,
           r.declared_offer_count::integer AS declared_offer_count,
           r.declared_active_subscriptions::integer AS declared_subscriptions,
           (SELECT count(*)::integer FROM raw.subscription_offers o WHERE o.report_id = r.report_id) AS loaded_offers,
           (SELECT coalesce(sum(o.active_subscriptions), 0)::integer FROM raw.subscription_offers o WHERE o.report_id = r.report_id) AS loaded_subscriptions,
           (w.source_report_ids->>0) = r.report_id AS selected
    FROM raw.subscription_reports r
    LEFT JOIN marts.subscription_weekly w
      ON w.brand_id = r.brand_id AND w.marketplace = r.marketplace AND w.period_start = r.period_start
    WHERE r.brand_id = $1 AND r.marketplace = $2 AND r.period_start = $3::date
    ORDER BY r.revision`,
    [brandId, marketplace, periodStart],
  );

  return rows.map((row) => ({ ...toSourceReport(row), selected: row.selected }));
}

/** Every scope in the fixture, for the review workflow's scope picker. */
export async function listScopes(
  db: PGlite,
): Promise<{ brandId: string; brandName: string; marketplace: string }[]> {
  return queryRows<{ brandId: string; brandName: string; marketplace: string }>(
    db,
    `SELECT b.brand_id AS "brandId", b.name AS "brandName", s.marketplace
     FROM brands b JOIN (SELECT DISTINCT brand_id, marketplace FROM raw.subscription_reports) s USING (brand_id)
     ORDER BY b.name, s.marketplace`,
  );
}

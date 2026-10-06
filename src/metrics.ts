import type { PGlite } from '@electric-sql/pglite';
import { AS_OF, PERIOD_START, PERIOD_END, PREVIOUS_START, queryRows } from './database.ts';
import type { Evidence } from './types.ts';

export const METRICS_SQL = `
SELECT b.brand_id, b.name, w.active_subscriptions::text AS current_count,
       p.active_subscriptions::text AS previous_count,
       w.source_period_end::text, w.source_complete, w.source_report_ids,
       w.ingested_at::text, p.source_complete AS previous_complete,
       p.source_period_end::text AS previous_end
FROM brands b
LEFT JOIN marts.subscription_weekly w
  ON w.brand_id=b.brand_id AND w.marketplace=$2 AND w.period_start=$3::date
LEFT JOIN marts.subscription_weekly p
  ON p.brand_id=b.brand_id AND p.marketplace=$2 AND p.period_start=$4::date
WHERE b.brand_id=$1`;

interface Row {
  brand_id: string; name: string; current_count: string | null; previous_count: string | null;
  source_period_end: string | null; source_complete: boolean | null; source_report_ids: string[] | null;
  ingested_at: string | null; previous_complete: boolean | null; previous_end: string | null;
}

export async function getEvidence(db: PGlite, brandId: string, marketplace = 'US'): Promise<Evidence> {
  const [r] = await queryRows<Row>(db, METRICS_SQL, [brandId, marketplace, PERIOD_START, PREVIOUS_START]);
  if (!r) throw new Error(`Unknown brand: ${brandId}. Query SELECT * FROM brands to see valid IDs.`);
  const [sales] = await queryRows<{ total: string }>(db, `SELECT COALESCE(SUM(product_revenue + promotions + refunds),0)::text AS total FROM raw.sales_daily WHERE brand_id=$1 AND marketplace=$2 AND date BETWEEN $3::date AND $4::date`, [brandId, marketplace, PERIOD_START, PERIOD_END]);
  const [ads] = await queryRows<{ spend: string; sales: string }>(db, `SELECT COALESCE(SUM(spend),0)::text AS spend, COALESCE(SUM(attributed_sales),0)::text AS sales FROM raw.advertising_daily WHERE brand_id=$1 AND marketplace=$2 AND date BETWEEN $3::date AND $4::date`, [brandId, marketplace, PERIOD_START, PERIOD_END]);
  const [inventory] = await queryRows<{ units: string }>(db, `SELECT COALESCE(SUM(available_units),0)::text AS units FROM raw.inventory_snapshots WHERE brand_id=$1 AND marketplace=$2 AND date=(SELECT MAX(date) FROM raw.inventory_snapshots WHERE brand_id=$1 AND marketplace=$2 AND date <= $3::date)`, [brandId, marketplace, PERIOD_END]);
  const current = r.current_count === null ? null : Number(r.current_count);
  const previous = r.previous_count === null ? null : Number(r.previous_count);
  const sourceSnapshots = await queryRows<{ reportId: string; activeSubscriptions: number }>(db,
    `SELECT report_id AS "reportId", SUM(active_subscriptions)::integer AS "activeSubscriptions"
     FROM raw.subscription_offers WHERE report_id = ANY($1::text[]) GROUP BY report_id ORDER BY report_id`,
    [r.source_report_ids ?? []]);
  return {
    brandId, brandName: r.name, marketplace, periodStart: PERIOD_START, expectedPeriodEnd: PERIOD_END, asOf: AS_OF,
    activeSubscriptions: current, previousSubscriptions: previous,
    growthPct: null, sourceSnapshots,
    sourcePeriodEnd: r.source_period_end, sourceComplete: r.source_complete ?? false,
    sourceReports: r.source_report_ids ?? [], ingestedAt: r.ingested_at,
    previousSourceComplete: r.previous_complete ?? false, previousSourcePeriodEnd: r.previous_end,
    netSales: Number(sales.total), adSpend: Number(ads.spend), attributedAdSales: Number(ads.sales),
    roas: Number(ads.spend) > 0 ? Math.round(Number(ads.sales) / Number(ads.spend) * 100) / 100 : null,
    inventoryUnits: Number(inventory.units),
  };
}

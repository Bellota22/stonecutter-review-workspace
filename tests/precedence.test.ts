import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, rebuildMetrics, queryRows } from '../src/database.ts';
import { loadExports, scopeWeekKey } from './helpers/exports.ts';

const WEEK = '2026-09-28';

export interface SnapshotRow {
  brand_id: string;
  marketplace: string;
  period_start: string;
  active_subscriptions: number;
  source_report_ids: string[];
  source_period_end: string;
  source_complete: boolean;
  publisher_report_id: string;
  status: string;
  declared_offer_count: number;
  declared_active_subscriptions: number;
  loaded_offers: number;
  loaded_subs: number;
}

const SNAPSHOT_SQL = `
WITH sel AS (
  SELECT w.brand_id, w.marketplace, w.period_start, w.active_subscriptions,
         w.source_report_ids, w.source_period_end, w.source_complete,
         r.report_id AS rid, r.publisher_report_id, r.status,
         r.declared_offer_count, r.declared_active_subscriptions, r.period_end, r.generated_at
  FROM marts.subscription_weekly w
  JOIN raw.subscription_reports r ON r.report_id = (w.source_report_ids->>0)
)
SELECT brand_id, marketplace, period_start::text AS period_start,
       active_subscriptions::integer AS active_subscriptions, source_report_ids,
       source_period_end::text AS source_period_end, source_complete,
       publisher_report_id, status,
       declared_offer_count::integer AS declared_offer_count,
       declared_active_subscriptions::integer AS declared_active_subscriptions,
       (SELECT count(*)::integer FROM raw.subscription_offers o WHERE o.report_id = sel.rid) AS loaded_offers,
       (SELECT coalesce(sum(o.active_subscriptions), 0)::integer FROM raw.subscription_offers o WHERE o.report_id = sel.rid) AS loaded_subs
FROM sel
ORDER BY brand_id, marketplace, period_start`;

async function snapshots(): Promise<SnapshotRow[]> {
  const db = await openDatabase(true);
  try {
    await rebuildMetrics(db);
    return await queryRows<SnapshotRow>(db, SNAPSHOT_SQL);
  } finally {
    await db.close();
  }
}

async function snapshot(brandId: string, marketplace: string, periodStart: string) {
  const rows = await snapshots();
  return rows.find(
    (r) => r.brand_id === brandId && r.marketplace === marketplace && r.period_start === periodStart,
  );
}

test('every mart row is built from exactly one report and counts only that report offers', async () => {
  const rows = await snapshots();
  assert.ok(rows.length > 0, 'mart is empty');

  const duplicated = rows
    .filter((r) => r.source_report_ids.length !== 1)
    .map((r) => `${r.brand_id}/${r.marketplace}/${r.period_start} -> ${r.source_report_ids.length} reports`);
  assert.deepEqual(duplicated, [], `one authoritative report per scope and week: ${duplicated.join(', ')}`);

  const drifted = rows
    .filter((r) => r.active_subscriptions !== r.loaded_subs)
    .map(
      (r) =>
        `${r.brand_id}/${r.marketplace}/${r.period_start}: mart ${r.active_subscriptions} != loaded ${r.loaded_subs}`,
    );
  assert.deepEqual(drifted, [], `mart must equal the selected report totals: ${drifted.join(', ')}`);
});

test('every deviation from the publisher export is explained by a measured ingestion gap', async () => {
  const rows = await snapshots();
  const { currentByScopeWeek, offerTotals } = await loadExports();

  const unexplained: string[] = [];
  for (const row of rows) {
    const authoritative = currentByScopeWeek.get(
      scopeWeekKey(row.brand_id, row.marketplace, row.period_start),
    );
    if (!authoritative) continue; // no current publisher record -> surfaced as insufficient evidence by the app
    const published = offerTotals.get(authoritative.publisherReportId)!;
    const ingestionGap =
      row.loaded_offers !== row.declared_offer_count || row.loaded_subs !== row.declared_active_subscriptions;
    if (row.active_subscriptions !== published && !ingestionGap) {
      unexplained.push(
        `${row.brand_id}/${row.marketplace}/${row.period_start}: mart ${row.active_subscriptions} vs publisher ${published}`,
      );
    }
  }
  assert.deepEqual(unexplained, [], `deviations must be measurable: ${unexplained.join(', ')}`);
});

test('cedar-coast US records one report instead of summing three revisions', async () => {
  const row = await snapshot('cedar-coast', 'US', WEEK);
  assert.ok(row, 'cedar-coast/US snapshot is missing');
  assert.equal(row.source_report_ids.length, 1, 'cedar-coast/US must select one report');
  assert.equal(
    row.active_subscriptions,
    8400,
    'cedar-coast/US must report the current partial snapshot, not 24750',
  );
  assert.equal(row.publisher_report_id, 'US-cedar-coast-2026-09-28-g3');
  assert.equal(row.source_period_end, '2026-10-02', 'coverage end must stay visible');
  assert.equal(row.source_complete, false, 'a partial report is not a complete week');
});

test('harbor-pantry CA follows publisher supersession, not our import sequence', async () => {
  const row = await snapshot('harbor-pantry', 'CA', WEEK);
  assert.ok(row, 'harbor-pantry/CA snapshot is missing');
  assert.equal(row.source_report_ids.length, 1, 'harbor-pantry/CA must select one report');
  assert.equal(
    row.publisher_report_id,
    'CA-harbor-pantry-2026-09-28-g4',
    'a re-import of g3 must not outrank the publisher reissue g4',
  );
  assert.equal(row.active_subscriptions, 3780);
  assert.equal(row.source_complete, true);
});

test('a truncated import stays measurable instead of being silently trusted', async () => {
  const row = await snapshot('moss-trail', 'US', '2026-09-21');
  assert.ok(row, 'moss-trail/US previous week is missing');
  assert.equal(row.declared_offer_count > row.loaded_offers, true, 'fixture keeps a truncated import');
  assert.equal(
    row.active_subscriptions,
    row.loaded_subs,
    'the mart reports what was ingested, not what was declared',
  );
  assert.equal(row.active_subscriptions < row.declared_active_subscriptions, true);
});

test('a complete, comparable week keeps its published total', async () => {
  const row = await snapshot('lumen-home', 'CA', WEEK);
  assert.ok(row);
  assert.equal(row.active_subscriptions, 2800);
  assert.equal(row.loaded_subs, row.declared_active_subscriptions);
  assert.equal(row.source_complete, true);
});

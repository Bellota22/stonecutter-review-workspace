/**
 * Why the weekly selection uses ROW_NUMBER and not DENSE_RANK.
 *
 * Runs the three ranking functions over the same rows from the bundled data and prints what
 * `WHERE priority = 1` returns in each case. Run it with `npm run demo:ranking`.
 */
import { openDatabase, queryRows } from '../src/database.ts';

const SQL = `
SELECT brand_id, marketplace, publisher_report_id AS publication, status, revision,
       period_end::text AS covers_to, generated_at::text AS published,
       DENSE_RANK() OVER w_status AS dense_rank,
       RANK()       OVER w_status AS rank,
       ROW_NUMBER() OVER w_total  AS row_number
FROM raw.subscription_reports
WHERE period_start = '2026-09-28'
  AND (brand_id, marketplace) IN (('cedar-coast', 'US'), ('harbor-pantry', 'CA'))
WINDOW w_status AS (PARTITION BY brand_id, marketplace, period_start
                    ORDER BY (status = 'complete') DESC),
       w_total  AS (PARTITION BY brand_id, marketplace, period_start
                    ORDER BY (status = 'complete') DESC, period_end DESC,
                               generated_at DESC, revision DESC)
ORDER BY brand_id, revision`;

const WHAT_IS_COUNTED = `
SELECT brand_id || ' / ' || marketplace AS scope, report_id,
       DENSE_RANK() OVER w_status AS dense_rank,
       ROW_NUMBER() OVER w_total  AS row_number,
       (SELECT coalesce(sum(o.active_subscriptions), 0) FROM raw.subscription_offers o WHERE o.report_id = r.report_id) AS subs
FROM raw.subscription_reports r
WHERE period_start = '2026-09-28'
  AND (brand_id, marketplace) IN (('cedar-coast', 'US'), ('harbor-pantry', 'CA'))
WINDOW w_status AS (PARTITION BY brand_id, marketplace, period_start ORDER BY (status = 'complete') DESC),
       w_total  AS (PARTITION BY brand_id, marketplace, period_start
                    ORDER BY (status = 'complete') DESC, period_end DESC, generated_at DESC, revision DESC)`;

const pad = (value: string, width: number) => value.padEnd(width).slice(0, width);

const db = await openDatabase(true);

console.log('\nTHE SAME ROWS, RANKED THREE WAYS');
console.log('(one week, two scopes: the publisher reissued these weeks)\n');
console.log(
  `  ${pad('publication', 34)}${pad('status', 10)}${pad('rev', 5)}${pad('dense', 7)}${pad('rank', 6)}row_number`,
);

let current = '';
for (const row of await queryRows<Record<string, string | number>>(db, SQL)) {
  if (row.brand_id !== current) {
    current = String(row.brand_id);
    console.log(`\n  ${current.toUpperCase()} (${row.marketplace})`);
  }
  console.log(
    `  ${pad(String(row.publication), 34)}${pad(String(row.status), 10)}${pad(String(row.revision), 5)}` +
      `${pad(String(row.dense_rank), 7)}${pad(String(row.rank), 6)}${row.row_number}`,
  );
}

console.log('\nWHAT "WHERE priority = 1" RETURNS\n');

interface Counted {
  scope: string;
  dense_rank: number;
  row_number: number;
  subs: number;
}

const counted = await queryRows<Counted>(db, WHAT_IS_COUNTED);
const scopes = [...new Set(counted.map((row) => row.scope))].sort();
for (const scope of scopes) {
  const rows = counted.filter((row) => row.scope === scope);
  const dense = rows.filter((row) => Number(row.dense_rank) === 1);
  const single = rows.filter((row) => Number(row.row_number) === 1);
  const total = (list: Counted[]) => list.reduce((sum, row) => sum + Number(row.subs), 0);
  console.log(`  ${scope}`);
  console.log(`    DENSE_RANK : ${dense.length} row(s) counted → ${total(dense).toLocaleString('en-US')}`);
  console.log(
    `    ROW_NUMBER : ${single.length} row(s) counted → ${total(single).toLocaleString('en-US')}\n`,
  );
}

console.log('DENSE_RANK gives every tied row the same number, so "= 1" means "the best tier":');
console.log('all of them come back and the weekly mart adds the reissues together.');
console.log('ROW_NUMBER numbers 1..n inside the partition, so "= 1" means "the winner": one row.\n');

await db.close();

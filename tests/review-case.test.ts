import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT, openDatabase, queryRows } from '../src/database.ts';
import { migrate } from '../src/server/db.ts';
import { latestDecision } from '../src/server/reviewStore.ts';
import { PolicyViolation, generateReport, openCase, saveDecision } from '../src/server/caseService.ts';

async function runtime() {
  const dir = await mkdtemp(path.join(tmpdir(), 'review-case-'));
  return { dir, db: path.join(dir, 'marketplace'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/**
 * A publisher reissue, reproduced faithfully: the new report is imported AND the publisher export
 * records it as the current publication. Pointing the exports at an isolated copy keeps the bundled
 * inputs untouched, which is what the brief allows for changed-evidence tests.
 */
async function reissueExports(): Promise<{ restore: () => void }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'exports-'));
  const source = path.join(ROOT, 'data/exports');
  await copyFile(path.join(source, 'subscription_reports.csv'), path.join(dir, 'subscription_reports.csv'));
  await copyFile(path.join(source, 'subscription_offers.csv'), path.join(dir, 'subscription_offers.csv'));

  // The publisher supersedes g3 with g4: mark the old row and publish the new one.
  const reportsPath = path.join(dir, 'subscription_reports.csv');
  const lines = (await readFile(reportsPath, 'utf8')).trimEnd().split('\n');
  const superseded = lines.map((line) => {
    const cells = line.split(',');
    if (cells[0] !== 'US-lumen-home-2026-09-28-g3') return line;
    cells[7] = 'US-lumen-home-2026-09-28-g4';
    return cells.join(',');
  });
  superseded.push(
    'US-lumen-home-2026-09-28-g4,lumen-home,US,2026-09-28,2026-10-04,complete,2026-10-06T05:00:00Z,,1,9900',
  );
  await writeFile(reportsPath, `${superseded.join('\n')}\n`);
  await appendFile(
    path.join(dir, 'subscription_offers.csv'),
    'US-lumen-home-2026-09-28-g4,offer-1,SYN0000001,9900\n',
  );

  const previous = process.env.ASSESSMENT_EXPORTS_DIR;
  process.env.ASSESSMENT_EXPORTS_DIR = dir;
  return {
    restore: () => {
      if (previous === undefined) delete process.env.ASSESSMENT_EXPORTS_DIR;
      else process.env.ASSESSMENT_EXPORTS_DIR = previous;
      void rm(dir, { recursive: true, force: true });
    },
  };
}

async function open(runtimePath: string) {
  const db = await openDatabase(false, runtimePath);
  await migrate(db);
  return db;
}

test('a saved decision survives stopping and restarting the solution', async () => {
  const work = await runtime();
  try {
    const first = await open(work.db);
    try {
      const opened = await openCase(first, 'lumen-home', 'CA');
      assert.equal(opened.status, 'open');
      const { decision } = await saveDecision(first, 'lumen-home', 'CA', {
        outcome: 'expand_promotion',
        reason: 'Both weeks reconcile to the publisher header and growth is complete and comparable.',
      });
      assert.equal(decision.version, 1);
      assert.equal(decision.budgetChangePct, 10, 'the policy budget is applied, not a requested one');
    } finally {
      await first.close();
    }

    const second = await open(work.db);
    try {
      const reopened = await openCase(second, 'lumen-home', 'CA');
      assert.equal(reopened.status, 'decided');
      assert.ok(reopened.decision, 'the decision is owned by the storage layer, not the browser session');
      assert.equal(reopened.decision.outcome, 'expand_promotion');
      assert.equal(reopened.decision.version, 1);
      const events = await queryRows<{ type: string }>(
        second,
        'SELECT type FROM review.event ORDER BY event_id',
      );
      assert.deepEqual(
        events.map((e) => e.type),
        ['case_opened', 'decision_saved'],
      );
    } finally {
      await second.close();
    }
  } finally {
    await work.cleanup();
  }
});

test('the backend refuses an expansion the evidence cannot support', async () => {
  const work = await runtime();
  try {
    const db = await open(work.db);
    try {
      const opened = await openCase(db, 'cedar-coast', 'US');
      assert.equal(opened.verdict.outcome, 'hold');
      await assert.rejects(
        saveDecision(db, 'cedar-coast', 'US', {
          outcome: 'expand_promotion',
          reason: 'The model provider recommended a 20% expansion.',
        }),
        (error: unknown) => {
          assert.ok(error instanceof PolicyViolation, 'a policy violation, not a silent hold');
          assert.ok(
            error.violations.some((v) => /partial/i.test(v)),
            `violations name the coverage gap: ${error.violations}`,
          );
          return true;
        },
      );
      assert.equal(await latestDecision(db, opened.caseId), null, 'a refused decision is not stored');
      assert.equal((await openCase(db, 'cedar-coast', 'US')).status, 'open');

      // A held decision is always allowed to be recorded, with its limitations.
      const held = await saveDecision(db, 'cedar-coast', 'US', {
        outcome: 'hold',
        reason: 'Current report covers only through 2026-10-02, so growth is not comparable.',
      });
      assert.equal(held.decision.outcome, 'hold');
      assert.equal(held.decision.budgetChangePct, 0);
      assert.ok(
        held.decision.limitations.some((l) => /partial/i.test(l)),
        'limitations are stored with the decision',
      );
    } finally {
      await db.close();
    }
  } finally {
    await work.cleanup();
  }
});

test('changed evidence marks the review as requiring attention instead of reusing the approval', async () => {
  const work = await runtime();
  try {
    const db = await open(work.db);
    try {
      const opened = await openCase(db, 'lumen-home', 'US');
      assert.equal(opened.evidence.growthPct, 15);
      await saveDecision(db, 'lumen-home', 'US', {
        outcome: 'expand_promotion',
        reason: 'Complete, comparable snapshots for both weeks, 15% growth.',
      });
      const before = await generateReport(db, 'lumen-home', 'US');
      assert.equal(before.kind, 'ready');

      // The publisher reissues the week: new import, and the export records it as current.
      const reissue = await reissueExports();
      try {
        await db.query(`INSERT INTO raw.subscription_reports
        (report_id, brand_id, marketplace, period_start, period_end, revision, status, extracted_at,
         publisher_report_id, generated_at, declared_offer_count, declared_active_subscriptions)
        VALUES ('lumen-us-w12-r4','lumen-home','US','2026-09-28','2026-10-04',4,'complete','2026-10-06T06:00:00Z',
                'US-lumen-home-2026-09-28-g4','2026-10-06T05:00:00Z',1,9900)`);
        await db.query(`INSERT INTO raw.subscription_offers (report_id, offer_id, asin, active_subscriptions)
        VALUES ('lumen-us-w12-r4','offer-1','SYN0000001',9900)`);

        const after = await generateReport(db, 'lumen-home', 'US');
        assert.equal(after.kind, 'requires_attention', 'the old approval is not reused');
        if (after.kind !== 'requires_attention') return;
        assert.ok(
          after.changes.some((c) => c.includes('US-lumen-home-2026-09-28-g4')),
          `changes name the new report: ${after.changes}`,
        );

        const reopened = await openCase(db, 'lumen-home', 'US');
        assert.equal(reopened.status, 'needs_attention');
        assert.equal(
          reopened.evidence.activeSubscriptions,
          9900,
          'the new publisher report drives the figure',
        );

        // Revalidating on the new evidence clears the attention state.
        await saveDecision(db, 'lumen-home', 'US', {
          outcome: 'expand_promotion',
          reason: 'Revalidated after the publisher reissue; growth is now 10%.',
        });
        assert.equal((await generateReport(db, 'lumen-home', 'US')).kind, 'ready');
      } finally {
        reissue.restore();
      }
    } finally {
      await db.close();
    }
  } finally {
    await work.cleanup();
  }
});

test('every candidate report carries the reason it was not used', async () => {
  const work = await runtime();
  try {
    const db = await open(work.db);
    try {
      const cedar = await openCase(db, 'cedar-coast', 'US');
      assert.equal(cedar.candidates.filter((c) => c.verdict === 'selected').length, 1);
      const rejected = cedar.candidates.filter((c) => c.verdict === 'rejected');
      assert.equal(rejected.length, 2);
      assert.ok(
        rejected.every((c) => c.reason.length > 0 && !c.reason.startsWith('Rejected:')),
        rejected.map((c) => c.reason).join(' | '),
      );

      const harbor = await openCase(db, 'harbor-pantry', 'CA');
      const reasons = harbor.candidates.map((c) => `${c.publisherReportId}: ${c.reason}`);
      assert.ok(
        reasons.some((r) => /superseded/i.test(r)),
        `supersession is explained: ${reasons.join(' | ')}`,
      );
    } finally {
      await db.close();
    }
  } finally {
    await work.cleanup();
  }
});

test('a report the publisher never exported cannot be approved', async () => {
  const work = await runtime();
  try {
    const db = await open(work.db);
    try {
      await db.query(`INSERT INTO raw.subscription_reports
        (report_id, brand_id, marketplace, period_start, period_end, revision, status, extracted_at,
         publisher_report_id, generated_at, declared_offer_count, declared_active_subscriptions)
        VALUES ('lumen-us-w12-r9','lumen-home','US','2026-09-28','2026-10-04',9,'complete','2026-10-06T07:00:00Z',
                'US-lumen-home-2026-09-28-g9','2026-10-06T06:00:00Z',1,9999)`);
      await db.query(`INSERT INTO raw.subscription_offers (report_id, offer_id, asin, active_subscriptions)
        VALUES ('lumen-us-w12-r9','offer-1','SYN0000001',9999)`);

      const view = await openCase(db, 'lumen-home', 'US');
      assert.equal(view.evidence.currentReport?.publisherReportId, 'US-lumen-home-2026-09-28-g9');
      assert.ok(
        (view.evidence.checks ?? []).some((check) => check.code === 'current_matches_export' && !check.ok),
        'the export check names the unverifiable report',
      );
      assert.equal(view.verdict.outcome, 'hold');
      await assert.rejects(
        saveDecision(db, 'lumen-home', 'US', {
          outcome: 'expand_promotion',
          reason: 'A number we cannot verify.',
        }),
        PolicyViolation,
      );
    } finally {
      await db.close();
    }
  } finally {
    await work.cleanup();
  }
});

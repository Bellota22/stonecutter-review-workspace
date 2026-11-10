import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, queryRows } from '../src/database.ts';
import { migrate } from '../src/server/db.ts';
import { latestDecision } from '../src/server/reviewStore.ts';
import { PolicyViolation, generateReport, openCase, saveDecision } from '../src/server/caseService.ts';

async function runtime() {
  const dir = await mkdtemp(path.join(tmpdir(), 'review-case-'));
  return { dir, db: path.join(dir, 'marketplace'), cleanup: () => rm(dir, { recursive: true, force: true }) };
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
    const opened = await openCase(first, 'lumen-home', 'CA');
    assert.equal(opened.status, 'open');
    const { decision } = await saveDecision(first, 'lumen-home', 'CA', {
      outcome: 'expand_promotion',
      reason: 'Both weeks reconcile to the publisher header and growth is complete and comparable.',
    });
    assert.equal(decision.version, 1);
    assert.equal(decision.budgetChangePct, 10, 'the policy budget is applied, not a requested one');
    await first.close();

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

      // The publisher reissues the week in an isolated copy of the working database.
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
      assert.equal(reopened.evidence.activeSubscriptions, 9900, 'the new publisher report drives the figure');

      // Revalidating on the new evidence clears the attention state.
      await saveDecision(db, 'lumen-home', 'US', {
        outcome: 'expand_promotion',
        reason: 'Revalidated after the publisher reissue; growth is now 10%.',
      });
      assert.equal((await generateReport(db, 'lumen-home', 'US')).kind, 'ready');
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
        rejected.every((c) => c.reason.startsWith('Rejected:')),
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

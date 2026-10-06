import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, rebuildMetrics } from '../src/database.ts';
import { analyse } from '../src/analyst.ts';

test('bundled data loads and the report exposes evidence and a trace', async () => {
  const db = await openDatabase(true);
  try {
    await rebuildMetrics(db);
    const report = await analyse(db, 'cedar-coast');
    assert.equal(report.evidence.brandId, 'cedar-coast');
    assert.equal(report.evidence.marketplace, 'US');
    assert.ok(report.trace.sql.length > 0);
    assert.ok(report.trace.context.documents.length > 0);
    assert.ok(['expand_promotion', 'hold'].includes(report.recommendation.action));
  } finally { await db.close(); }
});

test('an unknown brand produces an actionable error', async () => {
  const db = await openDatabase(true);
  try { await assert.rejects(analyse(db, 'unknown'), /Unknown brand/); }
  finally { await db.close(); }
});

test('a persistent working database reopens without replacing local changes', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'analyst-reopen-'));
  const runtime = path.join(temp, 'marketplace');
  try {
    const first = await openDatabase(false, runtime);
    try { await first.exec("CREATE TABLE reopen_probe (value text); INSERT INTO reopen_probe VALUES ('retained')"); }
    finally { await first.close(); }
    const second = await openDatabase(false, runtime);
    try { assert.deepEqual((await second.query('SELECT value FROM reopen_probe')).rows, [{ value: 'retained' }]); }
    finally { await second.close(); }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('Python is a required runtime with an actionable missing-interpreter error', async () => {
  const { pythonCommand } = await import('../src/python.ts');
  const previous = process.env.PYTHON;
  process.env.PYTHON = path.join(tmpdir(), 'nonexistent-assessment-python');
  try { assert.throws(() => pythonCommand(false), /Python 3.11.*npm run setup/); }
  finally {
    if (previous === undefined) delete process.env.PYTHON;
    else process.env.PYTHON = previous;
  }
});

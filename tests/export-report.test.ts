import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { exportFileName, renderPdf } from '../src/server/exportReport.ts';
import type { ClientReport } from '../src/domain/clientReport.ts';

const report: ClientReport = {
  draft: false,
  client: 'Harbor Pantry',
  marketplace: 'CA',
  period: { start: '2026-09-28', end: '2026-10-04' },
  decision: {
    outcome: 'hold',
    budgetChangePct: 0,
    reason: 'Growth is 5%, below the 10% the policy requires.',
    decidedAt: '2026-10-06T12:00:00.000Z',
  },
  supportedResult: [
    { label: 'Active subscriptions', value: '3,780', note: 'complete week through 2026-10-04' },
    { label: 'Previous week', value: '3,600', note: 'through 2026-09-27' },
    { label: 'Week-over-week change', value: '5%', note: 'policy needs 10%' },
  ],
  limitations: ['Complete comparable growth of 5% is below the 10% required to expand.'],
  nextStep: 'Keep the current promotion and report the verified 5% change.',
  sources: [
    {
      reportId: 'r1',
      publisherReportId: 'CA-harbor-pantry-2026-09-28-g4',
      status: 'complete',
      periodEnd: '2026-10-04',
    },
  ],
};

/** The PDF draws its text as hex strings, so the content is read back the same way a viewer would. */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  let out = '';
  for (const stream of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content = stream[1] ?? '';
    try {
      content = inflateSync(Buffer.from(content, 'latin1')).toString('latin1');
    } catch {
      // uncompressed content stream
    }
    for (const hex of content.matchAll(/<([0-9A-Fa-f]+)>/g)) {
      out += Buffer.from(hex[1] ?? '', 'hex').toString('latin1');
    }
  }
  return out;
}

test('the PDF export is a real document with the report inside', async () => {
  const bytes = await renderPdf(report);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString('latin1'), '%PDF-');
  const text = pdfText(bytes);
  for (const expected of [
    'Harbor Pantry',
    '3,780',
    '3,600',
    'Hold the current promotion',
    'LIMITATIONS',
    'NEXT STEP',
    'CA-harbor-pantry-2026-09-28-g4',
  ]) {
    assert.ok(text.includes(expected), `the PDF contains "${expected}"`);
  }
});

test('a draft export says so on the page and in the file name', async () => {
  const draft: ClientReport = { ...report, draft: true };
  assert.equal(exportFileName(draft), 'harbor-pantry-ca-2026-09-28-draft.pdf');
  const text = pdfText(await renderPdf(draft));
  assert.ok(text.includes('DRAFT'), 'the draft is marked in the document');
});

test('file names are predictable', () => {
  assert.equal(exportFileName(report), 'harbor-pantry-ca-2026-09-28-hold.pdf');
  assert.equal(
    exportFileName({
      ...report,
      decision: { ...report.decision, outcome: 'expand_promotion', budgetChangePct: 10 },
    }),
    'harbor-pantry-ca-2026-09-28-expand.pdf',
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { exportFileName, renderDocx, renderPdf } from '../src/server/exportReport.ts';
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

test('the PDF export is a real PDF document', async () => {
  const bytes = await renderPdf(report);
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, '%PDF-');
  assert.ok(bytes.byteLength > 1000, `expected a non-trivial document, got ${bytes.byteLength} bytes`);
});

/** Reads the entries of a zip package (stored or deflated), enough to inspect a docx. */
function readZip(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const dataStart = offset + 30 + nameLength + extraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, (method === 0 ? data : inflateRawSync(data)).toString('utf8'));
    offset = dataStart + compressedSize;
  }
  return entries;
}

test('the DOCX export is a real Word package with the report inside', async () => {
  const bytes = await renderDocx(report);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 2)), 'PK', 'a docx is a zip package');
  const entries = readZip(bytes);
  assert.ok(entries.has('word/document.xml'), `parts: ${[...entries.keys()].join(', ')}`);
  const document = entries.get('word/document.xml') ?? '';
  assert.ok(document.includes('w:document'), 'the document part is XML');
  assert.ok(document.includes('Harbor Pantry'), 'the client name is in the document');
  assert.ok(document.includes('3,780'), 'the verified figures are in the document');
  assert.ok(document.includes('Keep the current promotion'), 'the next step is in the document');
});

test('file names are predictable and mark drafts', () => {
  assert.equal(exportFileName(report, 'pdf'), 'harbor-pantry-ca-2026-09-28-hold.pdf');
  assert.equal(exportFileName({ ...report, draft: true }, 'docx'), 'harbor-pantry-ca-2026-09-28-draft.docx');
});

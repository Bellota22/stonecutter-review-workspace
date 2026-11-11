import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ClientReport } from '../domain/clientReport.ts';
import { POLICY } from '../domain/policy.ts';

/**
 * The client report as a file. Both formats are rendered from the same ClientReport object the page
 * shows, so the download and the screen can never disagree.
 */

const day = (value: string): string => (value ? value.slice(0, 10) : 'not recorded');

const outcomeLabel = (report: ClientReport): string =>
  report.decision.outcome === 'expand_promotion'
    ? `Expand the promotion by ${report.decision.budgetChangePct}% (draft for the brand manager)`
    : 'Hold the current promotion';

const title = (report: ClientReport): string => `Weekly marketplace performance — ${report.client}`;

const signature = (report: ClientReport): string =>
  `Generated from the validated review state · policy threshold ${POLICY.minimumGrowthPct}% growth / ${POLICY.budgetChangePct}% budget` +
  (report.draft ? ' · DRAFT: no decision recorded' : '');

export function exportFileName(report: ClientReport, format: 'pdf' | 'docx'): string {
  const scope = `${report.client}-${report.marketplace}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const state = report.draft ? 'draft' : report.decision.outcome === 'expand_promotion' ? 'expand' : 'hold';
  return `${scope}-${report.period.start}-${state}.${format}`;
}

/* ------------------------------------------------------------------ PDF */

/**
 * The standard PDF fonts cover Windows-1252, so typographic characters are folded to ASCII rather
 * than dropped as missing glyphs.
 */
const ascii = (text: string): string =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00b7/g, '|')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\n]/g, ' ');

const wrap = (text: string, width: number, measure: (value: string) => number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (measure(candidate) <= width || current === '') current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
};

export async function renderPdf(report: ClientReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth() - margin * 2;
  const ink = rgb(0.05, 0.08, 0.14);
  const muted = rgb(0.4, 0.44, 0.51);
  const accent = rgb(0.2, 0.31, 0.78);

  let y = page.getHeight() - margin;
  const write = (
    text: string,
    size: number,
    options: { bold?: boolean; color?: typeof ink; gap?: number } = {},
  ) => {
    const font = options.bold ? bold : regular;
    const measure = (value: string) => font.widthOfTextAtSize(value, size);
    for (const line of wrap(ascii(text), width, measure)) {
      if (y < margin + size) return;
      page.drawText(line, { x: margin, y, size, font, color: options.color ?? ink });
      y -= size * 1.45;
    }
    y -= options.gap ?? 0;
  };
  const rule = () => {
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: page.getWidth() - margin, y: y + 6 },
      thickness: 0.7,
      color: rgb(0.88, 0.9, 0.93),
    });
    y -= 10;
  };

  write(title(report), 18, { bold: true });
  write(
    `${report.marketplace} marketplace · week of ${day(report.period.start)} to ${day(report.period.end)}`,
    10,
    { color: muted, gap: 6 },
  );
  rule();
  write(outcomeLabel(report), 12, { bold: true, color: accent, gap: 4 });

  for (const row of report.supportedResult) {
    write(`${row.label}: ${row.value} (${row.note})`, 11);
  }
  y -= 6;
  rule();

  write('Why', 10, { bold: true, color: muted });
  write(report.decision.reason, 11, { gap: 6 });

  write('Limitations', 10, { bold: true, color: muted });
  if (report.limitations.length === 0)
    write('None material: both weeks are complete and reconcile to the publisher.', 11, { gap: 6 });
  else report.limitations.forEach((limitation) => write(`• ${limitation}`, 11));
  y -= 6;

  write('Next step', 10, { bold: true, color: muted });
  write(report.nextStep, 11, { gap: 6 });

  write('Sources', 10, { bold: true, color: muted });
  report.sources.forEach((source) =>
    write(`${source.publisherReportId} · ${source.status} · through ${day(source.periodEnd)}`, 9.5, {
      color: muted,
    }),
  );

  write(signature(report), 8.5, { color: muted, gap: 2 });

  return pdf.save();
}

/* ----------------------------------------------------------------- DOCX */

const cell = (text: string, bold = false): TableCell =>
  new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
  });

export async function renderDocx(report: ClientReport): Promise<Uint8Array> {
  const figures = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell('Figure', true), cell('Value', true), cell('Note', true)] }),
      ...report.supportedResult.map(
        (row) => new TableRow({ children: [cell(row.label), cell(row.value), cell(row.note)] }),
      ),
    ],
  });

  const document = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        children: [
          new Paragraph({ text: title(report), heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${report.marketplace} marketplace · week of ${day(report.period.start)} to ${day(report.period.end)}`,
                color: '666666',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: outcomeLabel(report), bold: true, color: '3450C8', size: 24 })],
            spacing: { before: 200, after: 200 },
          }),
          figures,
          new Paragraph({ text: 'Why', heading: HeadingLevel.HEADING_3, spacing: { before: 240 } }),
          new Paragraph({ children: [new TextRun({ text: report.decision.reason, size: 22 })] }),
          new Paragraph({ text: 'Limitations', heading: HeadingLevel.HEADING_3 }),
          ...(report.limitations.length === 0
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'None material: both weeks are complete and reconcile to the publisher.',
                      size: 22,
                    }),
                  ],
                }),
              ]
            : report.limitations.map(
                (limitation) => new Paragraph({ text: limitation, bullet: { level: 0 } }),
              )),
          new Paragraph({ text: 'Next step', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ children: [new TextRun({ text: report.nextStep, size: 22 })] }),
          new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_3 }),
          ...report.sources.map(
            (source) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${source.publisherReportId} · ${source.status} · through ${day(source.periodEnd)}`,
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
          ),
          new Paragraph({
            children: [new TextRun({ text: signature(report), size: 16, color: '888888' })],
            spacing: { before: 320 },
          }),
        ],
      },
    ],
  });

  return new Uint8Array(await Packer.toBuffer(document));
}

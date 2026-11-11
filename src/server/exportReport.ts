import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ClientReport } from '../domain/clientReport.ts';
import { POLICY } from '../domain/policy.ts';

/**
 * The client report as a PDF. It reproduces the on-screen report: header band with the status chip,
 * the three verified figures side by side, then why / limitations / next step / sources.
 */

const day = (value: string): string => (value ? value.slice(0, 10) : 'not recorded');

const outcomeLabel = (report: ClientReport): string =>
  report.decision.outcome === 'expand_promotion'
    ? `Expand the promotion by ${report.decision.budgetChangePct}%`
    : 'Hold the current promotion';

export function exportFileName(report: ClientReport): string {
  const scope = `${report.client}-${report.marketplace}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const state = report.draft ? 'draft' : report.decision.outcome === 'expand_promotion' ? 'expand' : 'hold';
  return `${scope}-${report.period.start}-${state}.pdf`;
}

const signature = (report: ClientReport): string =>
  `Generated from the validated review state · policy requires ${POLICY.minimumGrowthPct}% growth for a ${POLICY.budgetChangePct}% expansion` +
  (report.draft ? ' · DRAFT: no decision recorded' : '');

/** The standard PDF fonts cover Windows-1252, so typographic characters are folded to ASCII. */
const ascii = (text: string): string =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00b7/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\n]/g, ' ');

const INK = rgb(0.051, 0.082, 0.137);
const MUTED = rgb(0.4, 0.44, 0.51);
const LINE = rgb(0.878, 0.898, 0.925);
const SOFT = rgb(0.976, 0.98, 0.988);
const ACCENT = rgb(0.204, 0.314, 0.784);
const NEXT_BG = rgb(0.933, 0.945, 0.988);
const NEXT_INK = rgb(0.141, 0.188, 0.42);
const OK_BG = rgb(0.906, 0.965, 0.933);
const OK_INK = rgb(0.059, 0.427, 0.29);
const WARN_BG = rgb(0.992, 0.949, 0.875);
const WARN_INK = rgb(0.541, 0.325, 0);

interface Cursor {
  page: PDFPage;
  y: number;
}

export async function renderPdf(report: ClientReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const margin = 44;
  const expanded = report.decision.outcome === 'expand_promotion';

  const newPage = (): Cursor => {
    const page = pdf.addPage([595.28, 841.89]);
    return { page, y: page.getHeight() - margin };
  };

  let cursor = newPage();
  const width = cursor.page.getWidth() - margin * 2;

  const ensure = (height: number): void => {
    if (cursor.y - height < margin + 28) cursor = newPage();
  };

  const text = (
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      mono?: boolean;
      color?: typeof INK;
      x?: number;
      maxWidth?: number;
      lineGap?: number;
    } = {},
  ): void => {
    const size = options.size ?? 10;
    const chosen: PDFFont = options.mono ? mono : options.bold ? bold : regular;
    const limit = options.maxWidth ?? width;
    const x = options.x ?? margin;
    for (const line of wrap(ascii(value), limit, (part) => chosen.widthOfTextAtSize(part, size))) {
      ensure(size + 4);
      cursor.page.drawText(line, { x, y: cursor.y, size, font: chosen, color: options.color ?? INK });
      cursor.y -= size * (options.lineGap ?? 1.45);
    }
  };

  const rule = (gap = 14): void => {
    ensure(gap + 4);
    cursor.page.drawLine({
      start: { x: margin, y: cursor.y + 4 },
      end: { x: cursor.page.getWidth() - margin, y: cursor.y + 4 },
      thickness: 0.7,
      color: LINE,
    });
    cursor.y -= gap;
  };

  /* ---------------------------------------------------------------- header band */
  // Absolute coordinates: the band must never collide with the headline below it.
  const pageWidth = cursor.page.getWidth();
  const pageHeight = cursor.page.getHeight();
  const bandHeight = 88;
  const bandBottom = pageHeight - bandHeight;
  cursor.page.drawRectangle({ x: 0, y: bandBottom, width: pageWidth, height: bandHeight, color: SOFT });
  cursor.page.drawLine({
    start: { x: 0, y: bandBottom },
    end: { x: pageWidth, y: bandBottom },
    thickness: 0.7,
    color: LINE,
  });

  cursor.page.drawText('WEEKLY MARKETPLACE PERFORMANCE', {
    x: margin,
    y: pageHeight - 32,
    size: 7.5,
    font: bold,
    color: MUTED,
  });
  cursor.page.drawText(ascii(`${report.client} - ${report.marketplace}`), {
    x: margin,
    y: pageHeight - 54,
    size: 18,
    font: bold,
    color: INK,
  });
  cursor.page.drawText(
    ascii(
      report.draft
        ? `Week of ${day(report.period.start)} to ${day(report.period.end)} · draft, no decision recorded`
        : `Week of ${day(report.period.start)} to ${day(report.period.end)} · decision recorded ${day(report.decision.decidedAt)}`,
    ),
    { x: margin, y: pageHeight - 72, size: 9, font: regular, color: MUTED },
  );

  const chipText = expanded ? `Expand ${report.decision.budgetChangePct}%` : 'Hold';
  const chipSize = 8.5;
  const chipWidth = bold.widthOfTextAtSize(chipText, chipSize) + 20;
  const chipX = pageWidth - margin - chipWidth;
  const chipY = pageHeight - 58;
  cursor.page.drawRectangle({
    x: chipX,
    y: chipY,
    width: chipWidth,
    height: 18,
    color: expanded ? OK_BG : WARN_BG,
  });
  cursor.page.drawText(chipText, {
    x: chipX + 10,
    y: chipY + 5.5,
    size: chipSize,
    font: bold,
    color: expanded ? OK_INK : WARN_INK,
  });

  cursor.y = bandBottom - 30;

  /* ---------------------------------------------------------------- headline */
  text(outcomeLabel(report), { size: 12.5, bold: true, color: ACCENT });
  cursor.y -= 8;

  /* ---------------------------------------------------------------- figures */
  ensure(64);
  const columnWidth = width / 3;
  const figures = report.supportedResult;
  const startY = cursor.y;
  figures.forEach((row, index) => {
    const x = margin + columnWidth * index;
    if (index > 0) {
      cursor.page.drawLine({
        start: { x, y: startY - 8 },
        end: { x, y: startY - 58 },
        thickness: 0.7,
        color: LINE,
      });
    }
    cursor.page.drawText(ascii(row.label.toUpperCase()), {
      x: x + (index === 0 ? 0 : 10),
      y: startY,
      size: 7,
      font: bold,
      color: MUTED,
    });
    cursor.page.drawText(ascii(row.value), {
      x: x + (index === 0 ? 0 : 10),
      y: startY - 22,
      size: 15,
      font: bold,
      color: INK,
    });
    const notes = wrap(ascii(row.note), columnWidth - 16, (part) =>
      regular.widthOfTextAtSize(part, 7.5),
    ).slice(0, 2);
    notes.forEach((note, line) => {
      cursor.page.drawText(note, {
        x: x + (index === 0 ? 0 : 10),
        y: startY - 36 - line * 10,
        size: 7.5,
        font: regular,
        color: MUTED,
      });
    });
  });
  cursor.y = startY - 64;
  rule(16);

  /* ---------------------------------------------------------------- sections */
  const section = (label: string, provenance: string, body: () => void): void => {
    ensure(40);
    const labelWidth = bold.widthOfTextAtSize(label.toUpperCase(), 7.5);
    cursor.page.drawText(label.toUpperCase(), {
      x: margin,
      y: cursor.y,
      size: 7.5,
      font: bold,
      color: MUTED,
    });
    cursor.page.drawText(ascii(provenance), {
      x: margin + labelWidth + 5,
      y: cursor.y,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    cursor.y -= 14;
    body();
    cursor.y -= 10;
  };

  section('Why', '· the reason you recorded', () => {
    text(report.decision.reason, { size: 10 });
  });

  section('Limitations', '· from the checks that failed', () => {
    if (report.limitations.length === 0) {
      text('None material: both weeks are complete and reconcile to the publisher.', { size: 10 });
      return;
    }
    for (const limitation of report.limitations) text(`- ${limitation}`, { size: 10 });
  });

  ensure(56);
  const nextLabelWidth = bold.widthOfTextAtSize('NEXT STEP', 7.5);
  cursor.page.drawText('NEXT STEP', { x: margin, y: cursor.y, size: 7.5, font: bold, color: MUTED });
  cursor.page.drawText('· from the policy', {
    x: margin + nextLabelWidth + 5,
    y: cursor.y,
    size: 7.5,
    font: regular,
    color: MUTED,
  });
  cursor.y -= 14;
  const nextLines = wrap(ascii(report.nextStep), width - 24, (part) => regular.widthOfTextAtSize(part, 10));
  const boxHeight = nextLines.length * 14 + 16;
  cursor.page.drawRectangle({
    x: margin,
    y: cursor.y - boxHeight + 12,
    width,
    height: boxHeight,
    color: NEXT_BG,
  });
  nextLines.forEach((line, index) => {
    cursor.page.drawText(line, {
      x: margin + 12,
      y: cursor.y - index * 14,
      size: 10,
      font: regular,
      color: NEXT_INK,
    });
  });
  cursor.y -= boxHeight + 10;

  cursor.y -= 2;
  rule(12);
  text('Figures verified against the publisher weekly export before this report was produced.', {
    size: 7.5,
    color: MUTED,
  });
  text(signature(report), { size: 7.5, color: MUTED });

  return pdf.save();
}

const wrap = (value: string, limit: number, measure: (part: string) => number): string[] => {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (measure(candidate) <= limit || current === '') current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
};

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Minimal CSV reader for the bundled publisher exports (no embedded newlines or escaped quotes). */
function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else cell += char;
    }
    cells.push(cell);
    return cells;
  });
}

export interface ExportReport {
  publisherReportId: string;
  brandId: string;
  marketplace: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  supersededBy: string;
  offerCount: number;
  declaredSubscriptions: number;
}

/** Publisher exports are the authoritative source of record for this exercise. */
export async function loadExports(): Promise<{
  reports: ExportReport[];
  offerTotals: Map<string, number>;
  currentByScopeWeek: Map<string, ExportReport>;
}> {
  const reportsCsv = await readFile(path.join(ROOT, 'data/exports/subscription_reports.csv'), 'utf8');
  const offersCsv = await readFile(path.join(ROOT, 'data/exports/subscription_offers.csv'), 'utf8');

  const reports: ExportReport[] = parseCsv(reportsCsv).map((cells) => {
    const [publisherReportId, brandId, marketplace, periodStart, periodEnd, status] = cells;
    const supersededBy = cells[7] ?? '';
    return {
      publisherReportId: publisherReportId ?? '',
      brandId: brandId ?? '',
      marketplace: marketplace ?? '',
      periodStart: periodStart ?? '',
      periodEnd: periodEnd ?? '',
      status: status ?? '',
      supersededBy,
      offerCount: Number(cells[8] ?? 0),
      declaredSubscriptions: Number(cells[9] ?? 0),
    };
  });

  const offerTotals = new Map<string, number>();
  for (const cells of parseCsv(offersCsv)) {
    const id = cells[0] ?? '';
    offerTotals.set(id, (offerTotals.get(id) ?? 0) + Number(cells[3] ?? 0));
  }

  const currentByScopeWeek = new Map<string, ExportReport>();
  for (const report of reports) {
    if (report.supersededBy) continue;
    currentByScopeWeek.set(scopeWeekKey(report.brandId, report.marketplace, report.periodStart), report);
  }
  return { reports, offerTotals, currentByScopeWeek };
}

export function scopeWeekKey(brandId: string, marketplace: string, periodStart: string): string {
  return `${brandId}|${marketplace}|${periodStart}`;
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../database.ts';
import type { PublisherExport } from '../types.ts';

/**
 * The publisher's own records, downloaded by operations. `DATA_DICTIONARY.md` calls them the source
 * of record, so the workflow compares our import against them, not only against our own header copy.
 */
export interface PublisherExports {
  byPublisherReportId: Map<string, PublisherExport>;
  currentByScopeWeek: Map<string, PublisherExport>;
}

export const scopeWeekKey = (brandId: string, marketplace: string, periodStart: string): string =>
  `${brandId}|${marketplace}|${periodStart}`;

/** Minimal CSV reader for the bundled exports: no embedded newlines, quotes only around text cells. */
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

const cache = new Map<string, Promise<PublisherExports>>();

/** The bundled exports by default; tests and reviewers can point at a different dataset. */
export function exportsDirectory(): string {
  return process.env.ASSESSMENT_EXPORTS_DIR ?? path.join(ROOT, 'data/exports');
}

/** Parsed once per directory: the files are read-only inputs. */
export function publisherExports(): Promise<PublisherExports> {
  const directory = exportsDirectory();
  const entry = cache.get(directory) ?? load(directory);
  cache.set(directory, entry);
  return entry;
}

async function load(directory: string): Promise<PublisherExports> {
  const [reportsCsv, offersCsv] = await Promise.all([
    readFile(path.join(directory, 'subscription_reports.csv'), 'utf8'),
    readFile(path.join(directory, 'subscription_offers.csv'), 'utf8'),
  ]);

  const offerTotals = new Map<string, number>();
  for (const cells of parseCsv(offersCsv)) {
    const id = cells[0] ?? '';
    offerTotals.set(id, (offerTotals.get(id) ?? 0) + Number(cells[3] ?? 0));
  }

  const byPublisherReportId = new Map<string, PublisherExport>();
  const currentByScopeWeek = new Map<string, PublisherExport>();
  for (const cells of parseCsv(reportsCsv)) {
    const [publisherReportId, brandId, marketplace, periodStart, periodEnd, status] = cells;
    if (!publisherReportId || !brandId || !marketplace || !periodStart) continue;
    const report: PublisherExport = {
      publisherReportId,
      brandId,
      marketplace,
      periodStart,
      periodEnd: periodEnd ?? '',
      status: status ?? '',
      supersededBy: cells[7] ?? '',
      declaredSubscriptions: Number(cells[9] ?? 0),
      totalSubscriptions: offerTotals.get(publisherReportId) ?? Number(cells[9] ?? 0),
    };
    byPublisherReportId.set(publisherReportId, report);
    if (!report.supersededBy) {
      currentByScopeWeek.set(scopeWeekKey(brandId, marketplace, periodStart), report);
    }
  }
  return { byPublisherReportId, currentByScopeWeek };
}

/** The authoritative record for the week our selection picked, if the publisher published it. */
export async function exportFor(
  brandId: string,
  marketplace: string,
  periodStart: string,
): Promise<PublisherExport | null> {
  const { currentByScopeWeek } = await publisherExports();
  const report = currentByScopeWeek.get(scopeWeekKey(brandId, marketplace, periodStart));
  return report ?? null;
}

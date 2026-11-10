import type { ReactNode } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';

export const number = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-US');

export const day = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '—');

export const change = (value: number | null): string => (value === null ? 'Not comparable' : `${value}%`);

export const CHECK_LABELS: Record<string, string> = {
  import_fresh: 'Import freshness',
  current_complete: 'Current week coverage',
  previous_complete: 'Previous week coverage',
  current_reconciled: 'Current week vs publisher',
  previous_reconciled: 'Previous week vs publisher',
  baseline_available: 'Baseline available',
};

export function Chip({
  tone,
  children,
}: {
  tone: 'neutral' | 'ok' | 'warn' | 'block' | 'info';
  children: ReactNode;
}) {
  return (
    <span className={`chip chip--${tone}`}>
      <span className="chip__dot" />
      {children}
    </span>
  );
}

export function StatusChip({ view }: { view: CaseView }) {
  if (view.attention) return <Chip tone="block">Requires attention</Chip>;
  if (!view.decision) return <Chip tone="neutral">Open review</Chip>;
  return view.decision.outcome === 'expand_promotion' ? (
    <Chip tone="ok">Decision saved · expand</Chip>
  ) : (
    <Chip tone="warn">Decision saved · hold</Chip>
  );
}

export function Figure({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="figure">
      <div className="figure__label">{label}</div>
      <div className={`figure__value${value === 'Not comparable' ? ' figure__value--muted' : ''}`}>
        {value}
      </div>
      <div className={`figure__note${tone === 'warn' ? ' figure__note--warn' : ''}`}>{note}</div>
    </div>
  );
}

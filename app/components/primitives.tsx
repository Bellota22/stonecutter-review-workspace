import type { ReactNode } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';

export const number = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-US');

export const day = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '—');

export const change = (value: number | null): string =>
  value === null ? 'Not comparable' : `${value > 0 ? '+' : ''}${value}%`;

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

/** A number the user should read first. */
export function Metric({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'warn' | 'block' | 'ok';
}) {
  return (
    <div className={`metric${tone === 'default' ? '' : ` metric--${tone}`}`}>
      <span className="metric__label">{label}</span>
      <span
        className={`metric__value${value === 'Not comparable' || value === '—' ? ' metric__value--soft' : ''}`}
      >
        {value}
      </span>
      {note ? <span className="metric__note">{note}</span> : null}
    </div>
  );
}

/** Numbered marker used by the two action steps. */
export function StepBadge({ step, done = false }: { step: number; done?: boolean }) {
  return (
    <span className={`step${done ? ' step--done' : ''}`} aria-hidden="true">
      {done ? '✓' : step}
    </span>
  );
}

/** Case state, readable at a glance. */
export function StatusChip({ view }: { view: CaseView }) {
  if (view.attention) return <Chip tone="block">Requires attention</Chip>;
  if (!view.decision) return <Chip tone="neutral">Not reviewed</Chip>;
  return view.decision.outcome === 'expand_promotion' ? (
    <Chip tone="ok">Saved · expand {view.decision.budgetChangePct}%</Chip>
  ) : (
    <Chip tone="warn">Saved · hold</Chip>
  );
}

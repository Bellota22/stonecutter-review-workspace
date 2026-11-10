'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CaseState } from '../../src/server/reviewStore.ts';

export interface ScopeEntry {
  brandId: string;
  brandName: string;
  marketplace: string;
}

type Filter = 'all' | 'attention' | 'decided' | 'open';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'decided', label: 'Decided' },
  { key: 'open', label: 'Not reviewed' },
];

function statusOf(state: CaseState | undefined) {
  if (!state) return { label: 'Not reviewed', tone: '', group: 'open' as Filter };
  if (state.status === 'needs_attention')
    return { label: 'Requires attention', tone: 'dot--block', group: 'attention' as Filter };
  return state.outcome === 'expand_promotion'
    ? { label: 'Decision saved · expand', tone: 'dot--ok', group: 'decided' as Filter }
    : { label: 'Decision saved · hold', tone: 'dot--hold', group: 'decided' as Filter };
}

/** Scope picker with a text filter and a state filter, so a long list stays usable. */
export function ScopeGrid({ scopes, states }: { scopes: ScopeEntry[]; states: CaseState[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scopes
      .map((scope) => ({
        scope,
        status: statusOf(
          states.find((state) => state.brandId === scope.brandId && state.marketplace === scope.marketplace),
        ),
      }))
      .filter((row) => (filter === 'all' ? true : row.status.group === filter))
      .filter((row) =>
        needle === ''
          ? true
          : `${row.scope.brandName} ${row.scope.marketplace}`.toLowerCase().includes(needle),
      );
  }, [scopes, states, filter, query]);

  return (
    <section aria-label="Scopes">
      <div className="filters">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by brand or marketplace"
          aria-label="Filter scopes by brand or marketplace"
        />
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`filter${filter === entry.key ? ' filter--on' : ''}`}
            aria-pressed={filter === entry.key}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
        <span className="muted" style={{ fontSize: 12 }}>
          {rows.length} of {scopes.length}
        </span>
      </div>

      <div className="scopegrid">
        {rows.map(({ scope, status }) => (
          <Link
            key={`${scope.brandId}-${scope.marketplace}`}
            href={`/case/${scope.brandId}/${scope.marketplace}`}
            className="card card--link scopecard"
          >
            <div className="scopecard__head">
              <span className="scopecard__brand">{scope.brandName}</span>
              <span className="chip chip--neutral">{scope.marketplace}</span>
            </div>
            <span className="scopecard__status">
              <span className={`dot ${status.tone}`} />
              {status.label}
            </span>
            <span className="scopecard__cta">
              Open review <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p className="empty" style={{ gridColumn: '1 / -1' }}>
            No scope matches this filter.
          </p>
        ) : null}
      </div>
    </section>
  );
}

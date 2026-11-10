import Link from 'next/link';
import type { CaseState } from '../../src/server/reviewStore.ts';

export interface ScopeEntry {
  brandId: string;
  brandName: string;
  marketplace: string;
}

/** Left rail: every scope in the bundled data, with the state of its review case. */
export function ScopeNav({
  scopes,
  states,
  active,
}: {
  scopes: ScopeEntry[];
  states: CaseState[];
  active?: { brandId: string; marketplace: string };
}) {
  const stateFor = (scope: ScopeEntry) =>
    states.find((state) => state.brandId === scope.brandId && state.marketplace === scope.marketplace);

  return (
    <nav className="rail" aria-label="Marketplace scopes">
      <div>
        <div className="rail__title">Scopes · {scopes.length}</div>
        <div className="rail__list">
          {scopes.map((scope) => {
            const state = stateFor(scope);
            const isActive = active?.brandId === scope.brandId && active?.marketplace === scope.marketplace;
            return (
              <Link
                key={`${scope.brandId}-${scope.marketplace}`}
                href={`/case/${scope.brandId}/${scope.marketplace}`}
                className={`rail__item${isActive ? ' rail__item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>
                  {scope.brandName}
                  <small style={{ display: 'block' }}>{scope.marketplace}</small>
                </span>
                <span className={stateDot(state)} title={stateLabel(state)} />
              </Link>
            );
          })}
        </div>
      </div>
      <p className="rail__hint">
        Reporting week <strong>28 Sep – 4 Oct 2026</strong>. Clock fixed at 6 Oct 12:00 UTC. Publisher exports
        are the source of record.
      </p>
    </nav>
  );
}

function stateDot(state: CaseState | undefined): string {
  if (!state) return 'dot';
  if (state.status === 'needs_attention') return 'dot dot--block';
  return state.outcome === 'expand_promotion' ? 'dot dot--ok' : 'dot dot--warn';
}

function stateLabel(state: CaseState | undefined): string {
  if (!state) return 'Not reviewed';
  if (state.status === 'needs_attention') return 'Requires attention';
  return state.outcome === 'expand_promotion' ? 'Decision saved: expand' : 'Decision saved: hold';
}

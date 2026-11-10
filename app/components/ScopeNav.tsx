import Link from 'next/link';
import type { CaseView } from '../../src/server/caseService.ts';

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
  states: { brandId: string; marketplace: string; status: string; outcome: string | null }[];
  active?: Pick<CaseView['scope'], 'brandId' | 'marketplace'>;
}) {
  const stateFor = (scope: ScopeEntry) =>
    states.find((state) => state.brandId === scope.brandId && state.marketplace === scope.marketplace);

  return (
    <nav className="rail" aria-label="Marketplace scopes">
      <div>
        <div className="rail__title">Scopes</div>
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
                <StateDot state={state} />
              </Link>
            );
          })}
        </div>
      </div>
      <div className="notice notice--info" style={{ fontSize: 12 }}>
        <span className="notice__mark">i</span>
        <div>
          Reporting week <strong>28 Sep – 4 Oct 2026</strong>, clock fixed at 6 Oct 2026 12:00 UTC. Publisher
          exports are the source of record.
        </div>
      </div>
    </nav>
  );
}

function StateDot({ state }: { state?: { status: string; outcome: string | null } }) {
  if (!state) return <span className="chip__dot" style={{ background: '#d5dae2' }} title="Not reviewed" />;
  if (state.status === 'needs_attention')
    return <span className="chip__dot" style={{ background: 'var(--block)' }} title="Requires attention" />;
  if (state.outcome === 'expand_promotion')
    return <span className="chip__dot" style={{ background: 'var(--ok)' }} title="Decision saved: expand" />;
  return <span className="chip__dot" style={{ background: '#d9a13b' }} title="Decision saved: hold" />;
}

/** Loading placeholders for the streamed sections of a case. Each boundary gets its own shape. */

export function NavSkeleton() {
  return (
    <div className="rail" aria-hidden="true">
      <div className="rail__title">Scopes</div>
      {Array.from({ length: 7 }).map((_, index) => (
        <div className="skeleton" key={index} style={{ height: 34, marginBottom: 6 }} />
      ))}
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="stack" aria-hidden="true">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div className="skeleton" style={{ height: 28, width: '38%' }} />
        <div className="skeleton" style={{ height: 22, width: 110 }} />
      </div>
      <div className="metrics">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="metric" key={index}>
            <div className="skeleton" style={{ height: 9, width: '60%' }} />
            <div className="skeleton" style={{ height: 22, width: '45%', marginTop: 8 }} />
            <div className="skeleton" style={{ height: 8, width: '75%', marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="verdictbar">
        <div className="skeleton" style={{ height: 20, width: 74 }} />
        <div>
          <div className="skeleton" style={{ height: 14, width: '70%' }} />
          <div className="skeleton" style={{ height: 10, width: '40%', marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <section className="card" aria-hidden="true">
      <div className="card__body" style={{ display: 'grid', gap: 12 }}>
        {title ? <div className="skeleton" style={{ height: 16, width: '34%' }} /> : null}
        {Array.from({ length: rows }).map((_, index) => (
          <div className="skeleton" key={index} style={{ height: 34 }} />
        ))}
      </div>
    </section>
  );
}

export function RailSkeleton() {
  return (
    <aside className="actionrail" aria-hidden="true">
      <section className="card actioncard">
        <div className="skeleton" style={{ height: 18, width: '55%' }} />
        <div className="skeleton" style={{ height: 11, width: '80%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 52, flex: 1 }} />
          <div className="skeleton" style={{ height: 52, flex: 1 }} />
        </div>
        <div className="skeleton" style={{ height: 74 }} />
        <div className="skeleton" style={{ height: 38 }} />
      </section>
    </aside>
  );
}

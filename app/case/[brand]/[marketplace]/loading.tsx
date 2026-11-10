export default function CaseLoading() {
  return (
    <main className="shell">
      <div className="rail">
        <div className="rail__title">Scopes</div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="skeleton" key={index} style={{ height: 38, marginBottom: 6 }} />
        ))}
      </div>
      <div className="stack">
        <div className="skeleton" style={{ height: 30, width: '40%' }} />
        <div className="card">
          <div className="card__body">
            <div className="skeleton" style={{ height: 60 }} />
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="skeleton" style={{ height: 200 }} />
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

export default function CaseError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shell" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <section className="card">
        <div className="state">
          <h2>The review could not be loaded</h2>
          <p role="alert">{error.message}</p>
          <p>
            The workspace reads the bundled database through a local process. Retry, and if it keeps failing
            run <span className="mono">npm run setup</span> and restart the server.
          </p>
          <button type="button" className="button button--primary" onClick={reset}>
            Retry
          </button>
        </div>
      </section>
    </main>
  );
}

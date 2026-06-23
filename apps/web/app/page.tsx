const checkpoints = [
  "CORTEX identity locked",
  "Continuity documents versioned",
  "Frontend scaffold ready",
  "Backend scaffold ready"
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Foundation</p>
        <h1>CORTEX</h1>
        <p className="summary">
          AI organization operating system scaffold. This screen exists to verify
          the web app boots cleanly before feature work begins.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Current Status</h2>
          <span>Core MVP preparation</span>
        </div>

        <ul className="checklist">
          {checkpoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

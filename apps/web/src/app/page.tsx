export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm"
        aria-labelledby="workspace-status-title"
      >
        <div
          className="mb-6 h-1 w-16 rounded-full bg-[linear-gradient(135deg,var(--blue-start),var(--blue-end))]"
          aria-hidden="true"
        />
        <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Team Cowork</p>
        <h1 id="workspace-status-title" className="text-xl font-semibold tracking-tight">
          업무 공간을 준비하고 있습니다.
        </h1>
      </section>
    </main>
  );
}

// Loading affordance for the 3–8s diagnosis (the Q15 "feels alive" answer —
// not streaming). Names what the system is doing so the wait reads as work, not
// a hang. Copy is a content draft (post-write review). A subtle pulse stands in
// for motion; richer animation is chunk-7 polish.
export function LoadingState() {
  return (
    <section className="rounded-lg border border-border bg-background-primary p-lg">
      <div className="flex items-center gap-md">
        <span className="h-2 w-2 animate-pulse rounded-pill bg-brand-primary" />
        <p className="text-text-secondary">
          Diagnosing — retrieving the runbook, checking the current access facts,
          and running the diagnosis a few times to confirm it&rsquo;s consistent…
        </p>
      </div>
    </section>
  );
}

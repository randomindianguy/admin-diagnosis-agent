// Shared outer card shell for every outcome surface (UI-SPEC Q3): the diagnosis
// component and the refusal component use the SAME shell — same width, border,
// radius, padding — so the system reads as one identity (Gestalt similarity).
// Only the INNER layout diverges (two-pane vs single-pane).
export function OutcomeCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background-secondary p-lg">
      {children}
    </section>
  );
}

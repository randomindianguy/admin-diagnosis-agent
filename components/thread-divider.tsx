// Thread divider — a muted hairline rule with a centered mono label, marking a
// LATER moment in an end-user thread. Introduced inline for the SID-69 clarify→
// resolve continuation; extracted here (SID-75) so the approval-result card can
// reuse the exact same "— N min later" treatment.
export function ThreadDivider({ label }: { label: string }) {
  return (
    <div className="my-xs flex items-center gap-sm" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[11px] text-text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

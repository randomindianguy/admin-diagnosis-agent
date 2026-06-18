import { Info } from "lucide-react";

// Disclosure banner (B.4) — end-user only. Tells the viewer the simplification is
// JTBD-driven, not role-based gating. SID-62: shown ONCE in the empty state (it
// was per-card before; in a multi-turn stream that repeated on every turn).
export function DisclosureBanner() {
  return (
    <div className="flex items-start gap-sm rounded-md border border-border bg-background-secondary px-md py-sm text-sm text-text-secondary">
      <Info size={16} aria-hidden className="mt-[2px] shrink-0" />
      <p>
        End-user view — what the person who&rsquo;s blocked sees. Toggle to Admin
        for the escalation package: the full gate-by-gate investigation an admin
        receives.
      </p>
    </div>
  );
}

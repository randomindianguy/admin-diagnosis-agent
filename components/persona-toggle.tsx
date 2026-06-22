"use client";

// Persona view toggle (SID-49 A.1; reframed SID-56). Two-state segmented control.
// End user is now the PRIMARY persona (default + first); "Admin" exposes the
// escalation-package view. No persistence. Subtle: existing dark-theme tokens
// only — the active segment reads as a raised surface (background-secondary).
export type PersonaView = "admin" | "end-user";

const OPTIONS: { value: PersonaView; label: string }[] = [
  { value: "end-user", label: "End user" },
  { value: "admin", label: "Admin" },
];

export function PersonaToggle({
  value,
  onChange,
  unseenCount = 0,
  endUserUnseenCount = 0,
}: {
  value: PersonaView;
  onChange: (next: PersonaView) => void;
  unseenCount?: number; // SID-63: new tickets the admin hasn't seen
  endUserUnseenCount?: number; // SID-75: decisions the end user hasn't seen
}) {
  return (
    <div
      role="tablist"
      aria-label="Persona view"
      className="inline-flex rounded-md border border-border p-[2px]"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        // Change indicator (SID-63 Q6; SID-75 symmetric): neutral dot, or a count
        // badge if >1 unseen. Neutral (text-primary), not brand — keeps verdict
        // color semantics intact. Admin tab → new tickets; End user tab → unseen
        // approve/deny decisions.
        const count = o.value === "admin" ? unseenCount : endUserUnseenCount;
        const showIndicator = count > 0;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-tour={o.value === "admin" ? "admin-toggle" : undefined}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-[44px] items-center gap-xs rounded-sm px-md py-xs text-body transition-colors ${
              active
                ? "bg-background-secondary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {o.label}
            {showIndicator &&
              (count > 1 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-text-primary px-[3px] text-[10px] font-bold tabular-nums text-background-primary">
                  {count}
                </span>
              ) : (
                <span
                  className="h-2 w-2 rounded-full bg-text-primary"
                  aria-hidden
                />
              ))}
            {showIndicator && (
              <span className="sr-only">({count} new)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

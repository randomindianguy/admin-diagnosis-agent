"use client";

import { ChevronRight } from "lucide-react";

// View nav (SID-49 A.1; SID-56; SID-91). THREE-view sequence: End user →
// Methodology → Admin, the narrative middle act (eval methodology) sitting between
// the answer and the admin depth. Same chip pattern as the prior two-state toggle,
// with chevron separators between views; the active view is amber-highlighted.
// Visitors can jump to any view at any time — no forced linear flow.
export type PersonaView = "end-user" | "methodology" | "admin";

const OPTIONS: { value: PersonaView; label: string }[] = [
  { value: "end-user", label: "End user" },
  { value: "methodology", label: "Methodology" },
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
      aria-label="View"
      className="inline-flex max-w-full items-center overflow-x-auto rounded-md border border-border p-[2px]"
    >
      {OPTIONS.map((o, i) => {
        const active = o.value === value;
        // Change indicator (SID-63/SID-75): admin → new tickets; end user → unseen
        // decisions. Methodology has no indicator. Neutral dot, or count badge if >1.
        const count =
          o.value === "admin"
            ? unseenCount
            : o.value === "end-user"
              ? endUserUnseenCount
              : 0;
        const showIndicator = count > 0;
        return (
          <div key={o.value} className="flex shrink-0 items-center">
            {i > 0 && (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-text-muted"
                aria-hidden
              />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              data-tour={o.value === "admin" ? "admin-toggle" : undefined}
              onClick={() => onChange(o.value)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-xs rounded-sm px-md py-xs text-body transition-colors ${
                active
                  ? "border border-accent/40 bg-accent/10 text-accent"
                  : "border border-transparent text-text-secondary hover:text-text-primary"
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
              {showIndicator && <span className="sr-only">({count} new)</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

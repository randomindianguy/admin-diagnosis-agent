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
}: {
  value: PersonaView;
  onChange: (next: PersonaView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Persona view"
      className="inline-flex rounded-md border border-border p-[2px]"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-[44px] items-center rounded-sm px-md py-xs text-body transition-colors ${
              active
                ? "bg-background-secondary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

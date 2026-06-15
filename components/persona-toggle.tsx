"use client";

// Persona view toggle (SID-49 A.1). Two-state segmented control — the navigational
// element for the whole disclosure feature. Default Admin. No persistence. Subtle:
// existing dark-theme tokens only, no new accent — the active segment reads as a
// raised surface (background-secondary) on the page (background-primary).
export type PersonaView = "admin" | "end-user";

const OPTIONS: { value: PersonaView; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "end-user", label: "End user" },
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
            className={`rounded-sm px-md py-xs text-body transition-colors ${
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

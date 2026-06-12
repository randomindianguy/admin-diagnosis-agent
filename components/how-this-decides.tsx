"use client";

import { useState } from "react";

// Expandable "how this decides" near the verdict (UI-SPEC trust scaffolding).
// Closed by default. Copy is AUTHOR-OWNED (draft below — rewrite).
export function HowThisDecides() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="self-start text-body text-brand-primary"
        aria-expanded={open}
      >
        {open ? "Hide how this decides" : "How this decides"}
      </button>
      {open && (
        <p className="text-body text-text-secondary">
          {/* AUTHOR-OWNED DRAFT — rewrite. */}
          This system retrieves the most relevant runbook page and the current
          access facts, then checks two things before resolving: whether the
          retrieved evidence is relevant enough (evidence sufficiency), and
          whether the same diagnosis holds across repeated checks (answer
          consistency). If either check fails, it escalates to a human instead of
          answering with low confidence.
        </p>
      )}
    </div>
  );
}

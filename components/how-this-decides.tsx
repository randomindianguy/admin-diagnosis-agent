"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Expandable "how this decides" near the verdict (trust scaffolding). Proper
// disclosure affordance (SID-48 A.2): a bordered button with a chevron that
// rotates on toggle; expanded copy sits in a contained block. Restrained — this
// is secondary content, not a primary action. Copy is AUTHOR-OWNED (draft).
export function HowThisDecides() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-xs self-start rounded-md border border-border px-sm py-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronDown
          size={16}
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
        How this decides
      </button>
      {open && (
        <div className="rounded-md border border-border bg-background-primary p-md text-text-secondary">
          {/* AUTHOR-OWNED DRAFT — rewrite. */}
          <p>
            This system retrieves the most relevant runbook page and the current
            access facts, then checks two things before resolving: whether the
            retrieved evidence is relevant enough (evidence sufficiency), and
            whether the same diagnosis holds across repeated checks (answer
            consistency). If either check fails, it escalates to a human instead
            of answering with low confidence.
          </p>
        </div>
      )}
    </div>
  );
}

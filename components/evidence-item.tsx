"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

// One retrieved-evidence entry (SID-48 A.1). Collapsed by default: a single row
// of filename + similarity + chevron. Expanded: the runbook snippet renders as
// real markdown (not the raw `# ...**bold**` dump it used to show) inside a subtle
// inset well, so it reads as a quoted excerpt — not a code block.
export function EvidenceItem({
  source,
  similarity,
  snippet,
}: {
  source: string;
  similarity: number;
  snippet: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-md rounded-md px-sm py-xs text-left transition-colors hover:bg-background-primary"
      >
        <span className="text-text-primary">{source}</span>
        <span className="flex items-center gap-sm text-text-secondary">
          <span>similarity {similarity.toFixed(2)}</span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        // Inset well — page-bg (darker than the card surface) reads as a quoted
        // excerpt. Markdown elements are restyled here because Tailwind preflight
        // strips heading sizes + list markers.
        <div
          className="rounded-md border border-border bg-background-primary p-md text-text-secondary [&>*+*]:mt-sm [&_a]:text-brand-primary [&_code]:rounded [&_code]:bg-background-secondary [&_code]:px-xs [&_code]:font-mono [&_code]:text-text-primary [&_h1]:font-medium [&_h1]:text-text-primary [&_h2]:font-medium [&_h2]:text-text-primary [&_li]:ml-lg [&_ol]:list-decimal [&_strong]:font-medium [&_strong]:text-text-primary [&_ul]:list-disc"
        >
          <ReactMarkdown>{snippet}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

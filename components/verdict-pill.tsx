import { Check, AlertTriangle, Info } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";

// Verdict pill (SID-63) — the at-a-glance status on a feed card / ticket header.
// Reuses the LOCKED verdict accents (blue resolve · amber escalate · muted
// refuse) so the feed reads consistently with the end-user cards. No side-stripes.
export function verdictMeta(output: DiagnosisOutput): {
  label: string;
  cls: string;
} {
  if (output.verdict === "resolve")
    return { label: "Resolved", cls: "bg-brand-primary text-text-inverse" };
  if (output.verdict === "escalate")
    return { label: "Escalated", cls: "bg-state-warning text-surface-dark" };
  // refuse — out_of_scope is terminal; the two ambiguity reasons need detail.
  const label =
    output.refuse_reason === "out_of_scope" ? "Out of scope" : "Needs detail";
  return {
    label,
    cls: "border border-border bg-background-primary text-text-secondary",
  };
}

export function VerdictPill({ output }: { output: DiagnosisOutput }) {
  const m = verdictMeta(output);
  const Icon =
    output.verdict === "resolve"
      ? Check
      : output.verdict === "escalate"
        ? AlertTriangle
        : Info;
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-pill px-sm py-[2px] text-sm ${m.cls}`}
    >
      <Icon size={13} aria-hidden />
      {m.label}
    </span>
  );
}

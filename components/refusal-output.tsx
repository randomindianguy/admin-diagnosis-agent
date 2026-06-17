import { Info } from "lucide-react";
import { OutcomeCard } from "./outcome-card";
import type { DiagnosisOutput } from "@/lib/schema";

type RefuseOutput = Extract<DiagnosisOutput, { verdict: "refuse_out_of_scope" }>;

// Refusal component (UI-SPEC component 5; widened SID-56 Phase 2). Renders the
// refuse verdict on the ADMIN side. THREE SIBLING shapes, not a hierarchy —
// branched flat on refuse_reason:
//
//   out_of_scope       → author-owned scope-perimeter card (the escalation
//                         package an admin opens; shares the OutcomeCard shell).
//   resource_ambiguity → compact "clarification requested" note (Option A): the
//   intent_ambiguity      request was in scope but ambiguous, so the assistant
//                         asked the USER for more — nothing reached the admin,
//                         and there is no package to action. No trace, no card.
export function RefusalOutput({ output }: { output: RefuseOutput }) {
  // --- out_of_scope: the perimeter card (unchanged behavior). ---
  if (output.refuse_reason === "out_of_scope") {
    return (
      <OutcomeCard>
        <div className="flex flex-col gap-md">
          {/* Scope-perimeter copy (authored — SID-46 A.3). */}
          <h2 className="text-text-primary">
            Outside what this assistant handles
          </h2>
          <p className="text-text-secondary">
            This assistant focuses on workspace access — diagnosing why someone
            can or can&rsquo;t reach a resource, reporting on current access
            state, and recommending fixes. Some questions are routed to a human
            admin for execution.
          </p>
          <p className="text-text-secondary">
            It doesn&rsquo;t execute access changes, handle configuration, answer
            policy questions, or provide general IT support.
          </p>
        </div>
      </OutcomeCard>
    );
  }

  // --- resource_ambiguity / intent_ambiguity: the compact note. ---
  const unclear =
    output.refuse_reason === "resource_ambiguity"
      ? "which resource it was about"
      : "what the user was trying to do";
  return (
    <div className="flex items-start gap-sm rounded-md border border-border bg-background-secondary px-md py-md text-text-secondary">
      <Info size={18} aria-hidden className="mt-[2px] shrink-0" />
      <div className="flex flex-col gap-xs">
        <p className="text-text-primary">
          Clarification requested — nothing to action yet.
        </p>
        <p>
          The request was in scope, but it wasn&rsquo;t clear {unclear}, so the
          assistant asked the user for more detail instead of routing it here.
          There&rsquo;s no escalation package until they resubmit.
        </p>
        {output.missing_info && (
          <p className="text-sm text-text-muted">
            Asked: &ldquo;{output.missing_info}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

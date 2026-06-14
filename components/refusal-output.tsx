import { OutcomeCard } from "./outcome-card";

// Refusal component (UI-SPEC component 5). Renders the refuse_out_of_scope
// verdict, branched at the page level (SID-46 A.2). Shares the outer OutcomeCard
// shell with the diagnosis component (system identity) but uses a single-pane
// inner layout (dissimilarity-on-purpose: a category boundary, not a failed
// diagnosis). Scope-perimeter copy is AUTHOR-OWNED (SID-46 A.3, scope C): it
// states the in-scope perimeter positively so a refused user can recover via the
// always-visible input chip above.
export function RefusalOutput() {
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-md">
        {/* Scope-perimeter copy (authored — SID-46 A.3). */}
        <h2 className="text-text-primary">Outside what this assistant handles</h2>
        <p className="text-text-secondary">
          This assistant focuses on workspace access — diagnosing why someone can
          or can&rsquo;t reach a resource, reporting on current access state, and
          recommending fixes. Some questions are routed to a human admin for
          execution.
        </p>
        <p className="text-text-secondary">
          It doesn&rsquo;t execute access changes, handle configuration, answer
          policy questions, or provide general IT support.
        </p>
      </div>
    </OutcomeCard>
  );
}

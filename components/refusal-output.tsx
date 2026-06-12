import { OutcomeCard } from "./outcome-card";

// Refusal component (UI-SPEC component 5). SHELL ONLY for chunk 2 — the
// refuse_out_of_scope verdict + real logic land in chunk 3. Shares the outer
// OutcomeCard shell with the diagnosis component (system identity) but uses a
// single-pane inner layout (dissimilarity-on-purpose: a category boundary, not
// a failed diagnosis). Scope-perimeter copy is AUTHOR-OWNED (draft — rewrite).
export function RefusalOutput() {
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-md">
        {/* Scope-perimeter copy (authored). */}
        <p className="text-text-primary">
          This looks outside what this system handles. It diagnoses why a user
          can&rsquo;t access a workspace resource they should be able to. If your
          question is about an access issue, try rephrasing — or click the
          example above.
        </p>
        {/* Recovery path: the approved copy points to the always-visible input
            chip "above" (single-screen layout), so no re-surfaced chip is needed
            in the shell. Chunk 3 wires the real refuse_out_of_scope logic. */}
      </div>
    </OutcomeCard>
  );
}

import type { ReactNode } from "react";
import type { DiagnosisOutput } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";
import { HowThisDecides } from "./how-this-decides";

// Subtle section label — muted heading, regular weight. Reused across the
// confidence + evidence sections so they read as quiet structure, not headings
// that compete with the verdict (SID-46 B design constraint).
function SectionLabel({ children }: { children: ReactNode }) {
  // Body-size (Tailwind preflight resets heading size), muted color — quiet.
  return <h3 className="text-text-secondary">{children}</h3>;
}

// snake_case canonical label → display string. A presentation transform only;
// the underlying root_cause value is unchanged.
function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Renders resolve and escalate (refuse delegates to RefusalOutput at the page
// level, SID-46 A.2). Both share the same chrome: verdict pill top-left → decision
// area → a signals section ("Why we're confident" on resolve, "What we did see" on
// escalate) → Evidence. Resolve = brand-blue pill; escalate = amber/caution pill.
export function DiagnosisOutput({
  output,
}: {
  output: Exclude<DiagnosisOutput, { verdict: "refuse_out_of_scope" }>;
}) {
  if (output.verdict === "resolve") {
    const { agree, total } = output.consistency_votes;
    return (
      <OutcomeCard>
        <div className="flex flex-col gap-lg">
          {/* Verdict pill — top-left, chip-sized, brand blue (SID-46 D2). */}
          <div>
            <span className="inline-flex items-center gap-xs rounded-pill bg-brand-primary px-md py-xs text-text-inverse">
              ✓ Resolved
            </span>
          </div>

          {/* Decision: root cause + plain-language diagnosis. */}
          <div className="flex flex-col gap-sm">
            <span className="text-text-primary">{humanize(output.root_cause)}</span>
            <p className="whitespace-pre-wrap text-text-primary">
              {output.diagnosis_text}
            </p>
          </div>

          {/* Why we're confident — self-consistency + gate signals. */}
          <div className="flex flex-col gap-sm">
            <SectionLabel>Why we&rsquo;re confident</SectionLabel>
            <ul className="flex flex-col gap-xs">
              <li className="flex items-center justify-between gap-md">
                <span className="text-text-secondary">Self-consistency</span>
                <span className="text-text-primary">
                  {agree} of {total} samples agreed
                </span>
              </li>
              <li className="flex items-center justify-between gap-md">
                <span className="text-text-secondary">Gate signals</span>
                <span className="text-text-primary">
                  Sufficiency {output.gate_signals.sufficiency === "pass" ? "✓" : "✕"} ·
                  Consistency {output.gate_signals.consistency === "pass" ? "✓" : "✕"}
                </span>
              </li>
            </ul>
          </div>

          {/* Evidence — retrieved runbook page + retrieval similarity. */}
          <div className="flex flex-col gap-sm">
            <SectionLabel>Evidence</SectionLabel>
            {output.retrieved_evidence.map((e) => (
              <div key={e.source} className="flex flex-col gap-xs">
                <div className="flex items-center justify-between gap-md">
                  <span className="text-text-primary">{e.source}</span>
                  <span className="text-text-secondary">
                    similarity {output.top_similarity.toFixed(2)}
                  </span>
                </div>
                <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background-secondary p-sm text-text-secondary">
                  {e.snippet}
                </p>
              </div>
            ))}
          </div>

          <HowThisDecides />
        </div>
      </OutcomeCard>
    );
  }

  // escalate — same chrome as the resolve card (SID-46 B.2). The "What we did
  // see" section is honest disclosure: here's what we observed and why we chose
  // not to resolve — not a debug dump.
  const { agree, total } = output.consistency_votes;
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-lg">
        {/* Verdict pill — top-left, chip-sized, amber/caution (SID-46 D2).
            Dark text on amber for AA contrast (~5.3:1); text-text-primary token
            used in place of a literal zinc to keep the palette token-driven. */}
        <div>
          <span className="inline-flex items-center gap-xs rounded-pill bg-state-warning px-md py-xs text-text-primary">
            ⚠ Escalated
          </span>
        </div>

        {/* Decision: owner routing chip + the model's escalation reason. */}
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="text-text-secondary">Routed to</span>
            <span className="inline-flex items-center rounded-pill border border-border bg-background-secondary px-md py-xs text-text-primary">
              {output.owner}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-text-primary">
            {output.diagnosis_text}
          </p>
        </div>

        {/* What we did see — why we didn't resolve. */}
        <div className="flex flex-col gap-sm">
          <SectionLabel>What we did see</SectionLabel>
          <ul className="flex flex-col gap-xs">
            <li className="flex items-center justify-between gap-md">
              <span className="text-text-secondary">Self-consistency</span>
              <span className="text-text-primary">
                {agree} of {total} samples agreed
              </span>
            </li>
            <li className="flex items-center justify-between gap-md">
              <span className="text-text-secondary">Gate signals</span>
              <span className="text-text-primary">
                Sufficiency {output.gate_signals.sufficiency === "pass" ? "✓" : "✕"} ·
                Consistency {output.gate_signals.consistency === "pass" ? "✓" : "✕"}
              </span>
            </li>
          </ul>
        </div>

        {/* Evidence — what retrieval surfaced (same shape as resolve). */}
        <div className="flex flex-col gap-sm">
          <SectionLabel>Evidence</SectionLabel>
          {output.retrieved_evidence.map((e) => (
            <div key={e.source} className="flex flex-col gap-xs">
              <div className="flex items-center justify-between gap-md">
                <span className="text-text-primary">{e.source}</span>
                <span className="text-text-secondary">
                  similarity {output.top_similarity.toFixed(2)}
                </span>
              </div>
              <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background-secondary p-sm text-text-secondary">
                {e.snippet}
              </p>
            </div>
          ))}
        </div>

        <HowThisDecides />
      </div>
    </OutcomeCard>
  );
}

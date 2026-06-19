import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";
import { VerdictText } from "./verdict-pill";
import { HowThisDecides } from "./how-this-decides";
import { EvidenceItem } from "./evidence-item";
import { CopyButton } from "./copy-button";

// Subtle section label — muted heading, regular weight. Reused across the
// confidence + evidence sections so they read as quiet structure, not headings
// that compete with the verdict (SID-46 B design constraint).
function SectionLabel({ children }: { children: ReactNode }) {
  // SID-67: section eyebrow — display serif, italic, lowercase, muted. Quiet
  // structure that doesn't compete with the verdict.
  return (
    <h3 className="font-display text-displaySm italic lowercase text-text-muted">
      {children}
    </h3>
  );
}

// snake_case canonical label → display string. A presentation transform only;
// the underlying root_cause value is unchanged.
function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Gate-signal pass/fail mark — lucide Check / X, sized to the surrounding text,
// single-color (inherits) (SID-48 A.4, replaces the ✓/✕ glyphs).
function SignalMark({ pass }: { pass: boolean }) {
  return pass ? (
    <Check size={14} aria-label="pass" className="shrink-0" />
  ) : (
    <X size={14} aria-label="fail" className="shrink-0" />
  );
}

// Renders resolve and escalate (refuse delegates to RefusalOutput at the page
// level, SID-46 A.2). Both share the same chrome: verdict pill top-left → decision
// area → a signals section ("Why we're confident" on resolve, "What we did see" on
// escalate) → Evidence → copy action. Resolve = brand-blue pill; escalate = amber.
export function DiagnosisOutput({
  output,
}: {
  output: Exclude<DiagnosisOutput, { verdict: "refuse_out_of_scope" }>;
}) {
  if (output.verdict === "resolve") {
    const { agree, total } = output.consistency_votes;
    const copyText = [
      "Verdict: Resolved",
      `Root cause: ${humanize(output.root_cause)}`,
      "",
      output.diagnosis_text,
    ].join("\n");
    return (
      <OutcomeCard>
        <div className="flex flex-col gap-lg">
          {/* Verdict as content — display serif, colored (SID-67). The detail
              ("· Existing group access") carries the root cause, so no separate
              label line. */}
          <div className="flex flex-col gap-sm">
            <VerdictText output={output} />
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
                <span className="flex items-center gap-sm text-text-primary">
                  <span className="inline-flex items-center gap-xs">
                    Sufficiency
                    <SignalMark pass={output.gate_signals.sufficiency === "pass"} />
                  </span>
                  <span className="text-text-secondary">·</span>
                  <span className="inline-flex items-center gap-xs">
                    Consistency
                    <SignalMark pass={output.gate_signals.consistency === "pass"} />
                  </span>
                </span>
              </li>
            </ul>
          </div>

          {/* Evidence — collapsed rows; expand to rendered markdown (A.1). */}
          <div className="flex flex-col gap-sm">
            <SectionLabel>Evidence</SectionLabel>
            {output.retrieved_evidence.map((e) => (
              <EvidenceItem
                key={e.source}
                source={e.source}
                similarity={output.top_similarity}
                snippet={e.snippet}
              />
            ))}
          </div>

          <HowThisDecides />

          {/* Admin action — copy the diagnosis for a ticket / Slack (A.3). */}
          <CopyButton text={copyText} label="Copy diagnosis" />
        </div>
      </OutcomeCard>
    );
  }

  // escalate — same chrome as the resolve card. "What we did see" is honest
  // disclosure: here's what we observed and why we chose not to resolve.
  const { agree, total } = output.consistency_votes;
  const copyText = [
    "Verdict: Escalated",
    `Routed to: ${output.owner}`,
    "",
    output.diagnosis_text,
  ].join("\n");
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-lg">
        {/* Verdict as content — display serif, colored (SID-67). The detail
            ("· Identity team") carries the routing destination. */}
        <div className="flex flex-col gap-sm">
          <VerdictText output={output} />
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
              <span className="flex items-center gap-sm text-text-primary">
                <span className="inline-flex items-center gap-xs">
                  Sufficiency
                  <SignalMark pass={output.gate_signals.sufficiency === "pass"} />
                </span>
                <span className="text-text-secondary">·</span>
                <span className="inline-flex items-center gap-xs">
                  Consistency
                  <SignalMark pass={output.gate_signals.consistency === "pass"} />
                </span>
              </span>
            </li>
          </ul>
        </div>

        {/* Evidence — collapsed rows; expand to rendered markdown (A.1). */}
        <div className="flex flex-col gap-sm">
          <SectionLabel>Evidence</SectionLabel>
          {output.retrieved_evidence.map((e) => (
            <EvidenceItem
              key={e.source}
              source={e.source}
              similarity={output.top_similarity}
              snippet={e.snippet}
            />
          ))}
        </div>

        <HowThisDecides />

        {/* Admin action — copy the escalation summary (A.3). */}
        <CopyButton text={copyText} label="Copy summary" />
      </div>
    </OutcomeCard>
  );
}

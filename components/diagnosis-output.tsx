import type { ReactNode } from "react";
import { Check, AlertTriangle, X } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";
import { HowThisDecides } from "./how-this-decides";
import { EvidenceItem } from "./evidence-item";
import { CopyButton } from "./copy-button";

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
          {/* Verdict pill — top-left, chip-sized, brand blue. */}
          <div>
            <span className="inline-flex items-center gap-xs rounded-pill bg-brand-primary px-md py-xs text-text-inverse">
              <Check size={16} aria-hidden />
              Resolved
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
        {/* Verdict pill — amber/caution. Dark text on amber for AA contrast
            (~5.3:1) via surface.dark, a FIXED dark token (text.primary flips to
            near-white under the dark theme and would kill the contrast). */}
        <div>
          <span className="inline-flex items-center gap-xs rounded-pill bg-state-warning px-md py-xs text-surface-dark">
            <AlertTriangle size={16} aria-hidden />
            Escalated
          </span>
        </div>

        {/* Decision: owner routing chip + the model's escalation reason. */}
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="text-text-secondary">Routed to</span>
            <span className="inline-flex items-center rounded-pill border border-border bg-background-primary px-md py-xs text-text-primary">
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

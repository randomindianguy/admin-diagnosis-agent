import type { DiagnosisOutput, GateSignal } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";
import { HowThisDecides } from "./how-this-decides";

// snake_case canonical label → display string. A presentation transform only;
// the underlying root_cause value is unchanged.
function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Restrained pass/fail treatment: brand for pass, muted for fail. No semantic
// green/red — tokens.ts has no success/error colors (token gap flagged for
// chunk-7 polish); this keeps the muted Glean palette.
function SignalRow({ label, signal }: { label: string; signal: GateSignal }) {
  const pass = signal === "pass";
  return (
    <li className="flex items-center justify-between gap-md">
      <span className="text-text-secondary">{label}</span>
      <span className={pass ? "text-brand-primary" : "text-text-secondary"}>
        {pass ? "✓ pass" : "✕ fail"}
      </span>
    </li>
  );
}

// The V4 two-pane brief (UI-SPEC component 4). resolve and escalate are the same
// shape with a verdict-pill flip. Left pane = reasoning (evidence + gate
// signals); right pane = decision (verdict + root_cause/owner + diagnosis_text).
// Verdict badge labels and section headings are content drafts (post-write review).
export function DiagnosisOutput({ output }: { output: DiagnosisOutput }) {
  const resolved = output.verdict === "resolve";
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-lg md:flex-row md:gap-xl">
        {/* LEFT — reasoning */}
        <div className="flex flex-col gap-lg md:w-1/2 md:border-r md:border-border md:pr-xl">
          <div className="flex flex-col gap-sm">
            <h2 className="text-text-secondary">Retrieved evidence</h2>
            {output.retrieved_evidence.map((e) => (
              <div key={e.source} className="flex flex-col gap-xs">
                <span className="text-text-primary">{e.source}</span>
                <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background-secondary p-sm text-text-secondary">
                  {e.snippet}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-sm">
            <h2 className="text-text-secondary">Confidence checks</h2>
            <p className="text-text-secondary">
              Both must pass to resolve. Either failing forces escalation.
            </p>
            <ul className="flex flex-col gap-xs">
              <SignalRow
                label="Evidence sufficiency"
                signal={output.gate_signals.sufficiency}
              />
              <SignalRow
                label="Answer consistency"
                signal={output.gate_signals.consistency}
              />
            </ul>
          </div>
        </div>

        {/* RIGHT — decision */}
        <div className="flex flex-col gap-md md:w-1/2">
          <div className="flex flex-wrap items-center gap-md">
            <span
              className={
                resolved
                  ? "rounded-pill bg-surface-dark px-md py-xs text-text-inverse"
                  : "rounded-pill border border-border bg-background-secondary px-md py-xs text-text-primary"
              }
            >
              {resolved ? "Resolved" : "Escalated"}
            </span>
            {output.verdict === "resolve" ? (
              <span className="text-text-primary">
                {humanize(output.root_cause)}
              </span>
            ) : (
              <span className="text-text-secondary">
                Routed to {output.owner}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-text-primary">
            {output.diagnosis_text}
          </p>
          <HowThisDecides />
        </div>
      </div>
    </OutcomeCard>
  );
}

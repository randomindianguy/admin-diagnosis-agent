import type { ReactNode } from "react";
import {
  Search,
  Users,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { StatusFacts } from "@/lib/retrieval";

// Reasoning trace for the left pane (SID-48 B). Rendered statically AFTER
// diagnose() resolves — no streaming for V1. Each step is one row: muted icon +
// step name on the left, slightly stronger result on the right, faint separator
// between rows. Reads as honest "here's what I did," mirroring meeting-prep's
// tool-status pattern — not a debug log. Built only from existing output fields.

function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function TraceRow({
  icon,
  label,
  result,
}: {
  icon: ReactNode;
  label: string;
  result: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-md border-t border-border py-sm first:border-t-0">
      <span className="flex items-center gap-sm text-text-secondary">
        {icon}
        {label}
      </span>
      <span className="text-right text-text-primary">{result}</span>
    </li>
  );
}

function Mark({ pass }: { pass: boolean }) {
  return pass ? (
    <Check size={14} aria-label="pass" className="inline shrink-0" />
  ) : (
    <X size={14} aria-label="fail" className="inline shrink-0" />
  );
}

// "Maya R. → data-team-ml" (groups resolved id→name). Empty match is meaningful:
// for an out-of-scenario entity it's WHY the system escalated.
function identitySummary(status: StatusFacts): string {
  const nameOf = new Map(status.groups.map((g) => [g.id, g.name]));
  if (status.users.length === 0) return "no matching entities";
  return status.users
    .map((u) => {
      const groups =
        u.direct_group_memberships.map((id) => nameOf.get(id) ?? id).join(", ") ||
        "(no groups)";
      return `${u.name} → ${groups}`;
    })
    .join("; ");
}

// "Q3 Revenue Models: data-team = viewer"
function grantsSummary(status: StatusFacts): string {
  const nameOf = new Map(status.groups.map((g) => [g.id, g.name]));
  const lines = status.resources.flatMap((r) =>
    r.grants.map(
      (gr) => `${r.name}: ${nameOf.get(gr.principal) ?? gr.principal} = ${gr.level}`,
    ),
  );
  return lines.length ? lines.join("; ") : "no grants found";
}

const ICON = 16;

export function ReasoningTrace({ output }: { output: DiagnosisOutput }) {
  // Refuse short-circuits the gate, so the only honest trace is the scope call.
  if (output.verdict === "refuse_out_of_scope") {
    return (
      <ol className="flex flex-col">
        <TraceRow
          icon={<Search size={ICON} aria-hidden />}
          label="Scope check"
          result="Outside diagnosis scope"
        />
        <TraceRow
          icon={<X size={ICON} aria-hidden />}
          label="Verdict"
          result="Refused — out of scope"
        />
      </ol>
    );
  }

  const top = output.retrieved_evidence[0];
  const verdictRow =
    output.verdict === "resolve"
      ? {
          icon: <Check size={ICON} aria-hidden />,
          result: `Resolved · ${humanize(output.root_cause)}`,
        }
      : {
          icon: <AlertTriangle size={ICON} aria-hidden />,
          result: `Escalated · ${output.owner}`,
        };

  return (
    <ol className="flex flex-col">
      <TraceRow
        icon={<Search size={ICON} aria-hidden />}
        label="Retrieval"
        result={top ? `${top.source} · ${output.top_similarity.toFixed(2)}` : "no page found"}
      />
      <TraceRow
        icon={<Users size={ICON} aria-hidden />}
        label="Identity graph"
        result={identitySummary(output.status_facts)}
      />
      <TraceRow
        icon={<KeyRound size={ICON} aria-hidden />}
        label="Permission check"
        result={grantsSummary(output.status_facts)}
      />
      <TraceRow
        icon={<RefreshCw size={ICON} aria-hidden />}
        label="Self-consistency"
        result={`${output.consistency_votes.agree} of ${output.consistency_votes.total} agreed`}
      />
      <TraceRow
        icon={<ShieldCheck size={ICON} aria-hidden />}
        label="Gate signals"
        result={
          <span className="inline-flex items-center gap-xs">
            Sufficiency <Mark pass={output.gate_signals.sufficiency === "pass"} /> ·
            Consistency <Mark pass={output.gate_signals.consistency === "pass"} />
          </span>
        }
      />
      <TraceRow icon={verdictRow.icon} label="Verdict" result={verdictRow.result} />
    </ol>
  );
}

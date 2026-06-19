"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { StatusFacts } from "@/lib/retrieval";
import { usePrefersReducedMotion } from "@/hooks/use-trace-reveal";

// Admin reasoning trace (SID-50; SID-67 visual). THE signature element — a
// redacted case file, not a dashboard. Each step is one row: a mono uppercase
// field label on the left, the finding on the right, separated by hairline rules
// with no per-row boxes. Identifiers (paths, groups, grants, scores) render in
// mono; prose ("In scope") in sans; the closing verdict in display serif, colored.
// The block reads as a single audit document.
//
// Mechanics unchanged: rows mount one-by-one DURING the API call (revealedRowCount)
// showing skeletons; on resolve, skeletons swap to values one-by-one
// (swappedRowCount). Row 0 is "Scope check" so the refuse path is legible: scope
// fails → the rest short-circuits. End-user view does NOT use this component.

const TOTAL_ROWS = 7;

// Field labels for rows 0–5 (the verdict row, index 6, is handled per-path).
const LABELS = [
  "Scope check",
  "Retrieval",
  "Identity graph",
  "Permission check",
  "Self-consistency",
  "Gate signals",
];

type RefusePhase = "speculative" | "scopeSwap" | "collapse" | "done";

function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Mono value — the audit vocabulary: paths, group/channel identifiers, grants,
// scores. Reads as evidence quoted from the system, not prose.
function mono(value: ReactNode): ReactNode {
  return <span className="font-mono text-monoValue text-text-secondary">{value}</span>;
}

function Skeleton() {
  return (
    <span className="inline-block h-3 w-16 rounded-sm bg-background-tertiary align-middle motion-safe:animate-pulse" />
  );
}

function Mark({ pass }: { pass: boolean }) {
  return pass ? (
    <Check size={14} aria-label="pass" className="inline shrink-0" />
  ) : (
    <X size={14} aria-label="fail" className="inline shrink-0" />
  );
}

// The closing row — the verdict, as content. Display serif, colored by tone, to
// land the case file's conclusion in the same voice as the verdict treatment.
function VerdictValue({ output }: { output: DiagnosisOutput }) {
  const cls = "font-display text-[15px] font-medium tracking-display";
  if (output.verdict === "resolve")
    return (
      <span className={`${cls} text-verdict-resolve`}>
        Resolved <span className="text-text-muted">· {humanize(output.root_cause)}</span>
      </span>
    );
  if (output.verdict === "escalate")
    return (
      <span className={`${cls} text-verdict-escalate`}>
        Escalated <span className="text-text-muted">· {output.owner}</span>
      </span>
    );
  return <span className={`${cls} text-verdict-refuse`}>Refused · out of scope</span>;
}

function TraceRow({
  label,
  result,
  valueKey,
  className = "",
  noAnim = false,
}: {
  label: string;
  result: ReactNode;
  valueKey: string;
  className?: string;
  noAnim?: boolean;
}) {
  // noAnim (settled mode): a static record, not a live reveal — drop the per-row
  // entrance + value-fade so it reads as "already happened" (SID-63).
  return (
    <li
      className={`flex items-start justify-between gap-lg border-t border-border py-sm first:border-t-0 ${noAnim ? "" : "motion-safe:animate-[traceRowIn_300ms_ease-out_both]"} ${className}`}
    >
      <span className="shrink-0 pt-[3px] font-mono text-monoLabel uppercase tracking-monoLabel text-text-muted">
        {label}
      </span>
      <span
        key={valueKey}
        className={`max-w-[68%] text-right text-text-primary ${noAnim ? "" : "motion-safe:animate-[fadeIn_250ms_ease-out]"}`}
      >
        {result}
      </span>
    </li>
  );
}

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

function grantsSummary(status: StatusFacts): string {
  const nameOf = new Map(status.groups.map((g) => [g.id, g.name]));
  const lines = status.resources.flatMap((r) =>
    r.grants.map(
      (gr) => `${r.name}: ${nameOf.get(gr.principal) ?? gr.principal} = ${gr.level}`,
    ),
  );
  return lines.length ? lines.join("; ") : "no grants found";
}

const inScopeValue = (
  <span className="inline-flex items-center gap-xs">
    In scope <Check size={14} aria-label="in scope" className="inline shrink-0" />
  </span>
);
const outOfScopeValue = (
  <span className="inline-flex items-center gap-xs">
    Out of scope <X size={14} aria-label="out of scope" className="inline shrink-0" />
  </span>
);

export function ReasoningTrace({
  output,
  revealedRowCount,
  swappedRowCount,
  onSettled,
  settled = false,
}: {
  output: DiagnosisOutput | null;
  revealedRowCount: number;
  swappedRowCount: number;
  onSettled?: () => void;
  settled?: boolean; // SID-63: render the trace as a static, completed record
}) {
  const reduced = usePrefersReducedMotion();
  const isRefuse = output?.verdict === "refuse_out_of_scope";
  const [phase, setPhase] = useState<RefusePhase>("speculative");

  // Refuse transition: scope-swap → (350ms) collapse intermediates → (650ms) done
  // (verdict in). All transitions scheduled in timeout callbacks (never a
  // synchronous setState in the effect body). Reduced-motion and settled tickets
  // skip the machine and render "done" directly (computed below).
  useEffect(() => {
    if (!isRefuse || settled || reduced) return;
    const t0 = setTimeout(() => setPhase("scopeSwap"), 0);
    const t1 = setTimeout(() => setPhase("collapse"), 350);
    const t2 = setTimeout(() => setPhase("done"), 650);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isRefuse, reduced, settled]);

  // Settle signal → page un-gates the output card. Idempotent. (Not used in the
  // static settled mode.) Reduced-motion snaps straight to settled.
  useEffect(() => {
    if (settled) return;
    if (isRefuse) {
      if (reduced || phase === "done") onSettled?.();
      return;
    }
    if (output && swappedRowCount >= TOTAL_ROWS) onSettled?.();
  }, [settled, isRefuse, reduced, phase, output, swappedRowCount, onSettled]);

  // Reduced-motion + still loading: minimal static line.
  if (reduced && !output) {
    return <p className="text-text-secondary">Working…</p>;
  }

  // Settled tickets and reduced-motion render the final state directly.
  const effPhase: RefusePhase = settled || reduced ? "done" : phase;
  const effRevealed = settled ? TOTAL_ROWS : revealedRowCount;
  const effSwapped = settled ? TOTAL_ROWS : swappedRowCount;

  // Header — a serif eyebrow (italic, lowercase). The settled state reads as a
  // filed record (check); the live state pulses (amber) as "diagnosing…".
  const stillWorking =
    !settled &&
    ((isRefuse && effPhase !== "done") ||
      (!isRefuse && (!output || effSwapped < TOTAL_ROWS)));
  const eyebrow = "font-display text-displaySm italic lowercase";
  const header = settled ? (
    <p className={`mb-md flex items-center gap-xs text-text-muted ${eyebrow}`}>
      <Check size={13} aria-hidden /> reasoning trace
    </p>
  ) : stillWorking ? (
    <p className={`mb-md flex items-center gap-xs text-text-secondary ${eyebrow}`}>
      <span
        className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse"
        aria-hidden
      />
      diagnosing…
    </p>
  ) : null;

  const sk = <Skeleton />;

  // ---- REFUSE PATH ----
  if (isRefuse) {
    const scopeResult = effPhase === "speculative" ? sk : outOfScopeValue;
    const showIntermediates =
      effPhase === "speculative" ||
      effPhase === "scopeSwap" ||
      effPhase === "collapse";
    return (
      <div>
        {header}
        <ol className="flex flex-col">
          <TraceRow
            label={LABELS[0]}
            result={scopeResult}
            valueKey={effPhase === "speculative" ? "s" : "v"}
            noAnim={settled}
          />
          {showIntermediates &&
            LABELS.slice(1).map((label, j) => {
              const rowIndex = j + 1; // 1..5
              if (rowIndex >= effRevealed) return null; // not mounted yet
              return (
                <TraceRow
                  key={label}
                  label={label}
                  result={sk}
                  valueKey="s"
                  className={
                    effPhase === "collapse"
                      ? "motion-safe:animate-[fadeOut_300ms_ease-out_forwards]"
                      : ""
                  }
                />
              );
            })}
          {effPhase === "done" && output && (
            <TraceRow
              label="Verdict"
              result={<VerdictValue output={output} />}
              valueKey="v"
              noAnim={settled}
            />
          )}
        </ol>
      </div>
    );
  }

  // ---- RESOLVE / ESCALATE PATH ----
  const data = output;
  const top = data?.retrieved_evidence[0];
  const count = reduced ? (output ? TOTAL_ROWS : 0) : effRevealed;

  const valueFor = (i: number): ReactNode => {
    if (!data || i >= effSwapped) return sk;
    switch (i) {
      case 0:
        return inScopeValue;
      case 1:
        return mono(
          top ? `${top.source} · ${data.top_similarity.toFixed(2)}` : "no page found",
        );
      case 2:
        return mono(identitySummary(data.status_facts));
      case 3:
        return mono(grantsSummary(data.status_facts));
      case 4:
        return `${data.consistency_votes.agree} of ${data.consistency_votes.total} agreed`;
      case 5:
        return (
          <span className="inline-flex items-center gap-xs">
            Sufficiency <Mark pass={data.gate_signals.sufficiency === "pass"} /> ·
            Consistency <Mark pass={data.gate_signals.consistency === "pass"} />
          </span>
        );
      default:
        return <VerdictValue output={data} />;
    }
  };

  const labelFor = (i: number): string => (i < LABELS.length ? LABELS[i] : "Verdict");

  return (
    <div>
      {header}
      <ol className="flex flex-col">
        {Array.from({ length: count }, (_, i) => {
          const swapped = !!data && i < effSwapped;
          return (
            <TraceRow
              key={labelFor(i)}
              label={labelFor(i)}
              result={valueFor(i)}
              valueKey={swapped ? "v" : "s"}
              noAnim={settled}
            />
          );
        })}
      </ol>
    </div>
  );
}

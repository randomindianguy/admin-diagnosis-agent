"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Target,
  Search,
  Users,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Check,
  AlertTriangle,
  X,
  Circle,
} from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { StatusFacts } from "@/lib/retrieval";
import { usePrefersReducedMotion } from "@/hooks/use-trace-reveal";

// Admin reasoning trace (SID-50). Rows mount one-by-one DURING the API call
// (revealedRowCount) showing skeletons; when the call resolves, skeletons swap to
// values one-by-one (swappedRowCount). Row 0 is always "Scope check" so the refuse
// path is narratively legible: scope fails → the rest short-circuits. On refuse,
// the speculative diagnosis rows collapse and the verdict fades in. The card
// (page-gated) waits for onSettled. End-user view does NOT use this component.

const ICON = 16;
const TOTAL_ROWS = 7;

// Leading glyph + label for rows 0–5 (verdict row, index 6, is handled per-path).
const META: { icon: ReactNode; label: string }[] = [
  { icon: <Target size={ICON} aria-hidden />, label: "Scope check" },
  { icon: <Search size={ICON} aria-hidden />, label: "Retrieval" },
  { icon: <Users size={ICON} aria-hidden />, label: "Identity graph" },
  { icon: <KeyRound size={ICON} aria-hidden />, label: "Permission check" },
  { icon: <RefreshCw size={ICON} aria-hidden />, label: "Self-consistency" },
  { icon: <ShieldCheck size={ICON} aria-hidden />, label: "Gate signals" },
];

type RefusePhase = "speculative" | "scopeSwap" | "collapse" | "done";

function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Skeleton() {
  return (
    <span className="inline-block h-3 w-16 rounded-pill bg-background-secondary align-middle motion-safe:animate-pulse" />
  );
}

function Mark({ pass }: { pass: boolean }) {
  return pass ? (
    <Check size={14} aria-label="pass" className="inline shrink-0" />
  ) : (
    <X size={14} aria-label="fail" className="inline shrink-0" />
  );
}

function TraceRow({
  icon,
  label,
  result,
  valueKey,
  className = "",
  noAnim = false,
}: {
  icon: ReactNode;
  label: string;
  result: ReactNode;
  valueKey: string;
  className?: string;
  noAnim?: boolean;
}) {
  // noAnim (settled mode): the trace is a static record, not a live reveal — drop
  // the per-row entrance + value-fade so it reads as "already happened" (SID-63).
  return (
    <li
      className={`flex items-start justify-between gap-md border-t border-border py-sm first:border-t-0 ${noAnim ? "" : "motion-safe:animate-[traceRowIn_300ms_ease-out_both]"} ${className}`}
    >
      <span className="flex items-center gap-sm text-text-secondary">
        {icon}
        {label}
      </span>
      <span
        key={valueKey}
        className={`text-right text-text-primary ${noAnim ? "" : "motion-safe:animate-[fadeIn_250ms_ease-out]"}`}
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
  // (verdict in). All transitions are scheduled in timeout callbacks (never a
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

  // Header cue — the obvious-at-a-glance distinction between a live and a settled
  // trace (SID-63): a calm "Reasoning trace" with a check vs a pulsing "Diagnosing…".
  const stillWorking =
    !settled &&
    ((isRefuse && effPhase !== "done") ||
      (!isRefuse && (!output || effSwapped < TOTAL_ROWS)));
  const header = settled ? (
    <p className="mb-sm flex items-center gap-xs text-sm text-text-muted">
      <Check size={13} aria-hidden /> Reasoning trace
    </p>
  ) : stillWorking ? (
    <p className="mb-sm flex items-center gap-xs text-sm text-text-secondary">
      <span
        className="h-2 w-2 rounded-full bg-brand-primary motion-safe:animate-pulse"
        aria-hidden
      />
      Diagnosing…
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
            icon={META[0].icon}
            label={META[0].label}
            result={scopeResult}
            valueKey={effPhase === "speculative" ? "s" : "v"}
            noAnim={settled}
          />
          {showIntermediates &&
            META.slice(1).map((m, j) => {
              const rowIndex = j + 1; // 1..5
              if (rowIndex >= effRevealed) return null; // not mounted yet
              return (
                <TraceRow
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
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
          {effPhase === "done" && (
            <TraceRow
              icon={<X size={ICON} aria-hidden />}
              label="Verdict"
              result="Refused — out of scope"
              valueKey="v"
              noAnim={settled}
            />
          )}
        </ol>
      </div>
    );
  }

  // ---- RESOLVE / ESCALATE PATH ----
  // `output` is already narrowed to resolve|escalate|null here (the refuse path
  // returned above). `data` is non-null only once the result is in; values stay
  // skeleton until each row's swap turn (i < effSwapped).
  const data = output;
  const top = data?.retrieved_evidence[0];
  const count = reduced ? (output ? TOTAL_ROWS : 0) : effRevealed;

  const valueFor = (i: number): ReactNode => {
    if (!data || i >= effSwapped) return sk;
    switch (i) {
      case 0:
        return inScopeValue;
      case 1:
        return top ? `${top.source} · ${data.top_similarity.toFixed(2)}` : "no page found";
      case 2:
        return identitySummary(data.status_facts);
      case 3:
        return grantsSummary(data.status_facts);
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
        return data.verdict === "resolve"
          ? `Resolved · ${humanize(data.root_cause)}`
          : `Escalated · ${data.owner}`;
    }
  };

  const verdictIcon = data ? (
    data.verdict === "resolve" ? (
      <Check size={ICON} aria-hidden />
    ) : (
      <AlertTriangle size={ICON} aria-hidden />
    )
  ) : (
    <Circle size={ICON} aria-hidden className="text-text-muted" />
  );

  const iconFor = (i: number): ReactNode => (i < META.length ? META[i].icon : verdictIcon);
  const labelFor = (i: number): string => (i < META.length ? META[i].label : "Verdict");

  return (
    <div>
      {header}
      <ol className="flex flex-col">
        {Array.from({ length: count }, (_, i) => {
          const swapped = !!data && i < effSwapped;
          return (
            <TraceRow
              key={labelFor(i)}
              icon={iconFor(i)}
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

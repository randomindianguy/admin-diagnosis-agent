"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { StatusFacts } from "@/lib/retrieval";

// SID-90 Pipeline Timeline — surfaces the system's pipeline in END-USER view so the
// architectural aha lands without a toggle. Five tiles whose summaries are derived
// from fields already in the DiagnosisOutput payload (same derivations as the admin
// reasoning-trace, kept consistent). No streaming, no backend changes.
//
// SID-90-revise: the timeline now sits ABOVE the answer and animates DURING the wait
// via a MOCK schedule (usePipelineSchedule, driven from the page). So it renders in
// two states:
//   • loading (output === null): tiles activate one-by-one in a neutral, uncolored,
//     non-interactive state — the process happening "now" (present-tense eyebrow).
//   • settled (output present): tiles take their payload summaries + the verdict tile
//     its color; clicking a tile expands its one-line outcome.
// Refuse short-circuits the access-diagnosis pipeline: on a refuse payload tiles 1–4
// gray out (active→gray fades via motion-safe transition, so the retroactive skip
// reads as a smooth dim, not a flicker) under a single shared indicator.
// The CTA is a SEPARATE export (PipelineCTA) — it renders BELOW the answer.

type Tone = "resolve" | "escalate" | "refuse";

const TILE_TONE: Record<Tone, string> = {
  resolve: "border-verdict-resolve/40 bg-verdict-resolve/10 text-verdict-resolve",
  escalate: "border-verdict-escalate/40 bg-verdict-escalate/10 text-verdict-escalate",
  refuse: "border-verdict-refuse/50 bg-verdict-refuse/10 text-verdict-refuse",
};

function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Identity one-liner — same derivation as the admin reasoning-trace (kept in sync).
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

const STAGE_LABELS = ["Retrieval", "Identity", "Reasoning", "Gate", "Verdict"];

type Tile = {
  label: string;
  summary: string;
  active: boolean;
  tone?: Tone;
};

function verdictSummary(output: DiagnosisOutput): string {
  if (output.verdict === "resolve") return `Resolved · ${humanize(output.root_cause)}`;
  if (output.verdict === "escalate") return `Escalated · ${output.owner}`;
  return output.refuse_reason === "out_of_scope"
    ? "Refused · out of scope"
    : `Needs detail${output.missing_info ? ` · ${output.missing_info}` : ""}`;
}

// CTA copy — SID-91: this CTA now pivots to the METHODOLOGY view (how the verdict was
// graded), not Admin, so the copy promises grading insight. The "escalation package"
// framing moved to Methodology's own bottom CTA ("See what your admin received →"),
// which actually leads to Admin — so the chain reads truthfully at each step.
export function ctaLabel(output: DiagnosisOutput): string {
  if (output.verdict === "escalate") return "See how this was graded";
  if (output.verdict === "resolve") return "See how this was graded";
  return "See why this couldn't be grounded";
}

function buildTiles(output: DiagnosisOutput | null): Tile[] {
  // Loading (mock): neutral, uncolored, no summaries — the process happening now.
  if (!output) {
    return STAGE_LABELS.map((label) => ({ label, summary: "", active: true }));
  }

  const verdictTone: Tone =
    output.verdict === "resolve"
      ? "resolve"
      : output.verdict === "escalate"
        ? "escalate"
        : "refuse";

  // Refuse short-circuits the access-diagnosis pipeline — stages 1–4 carry no payload
  // data, so they render skipped. Only the verdict is active.
  if (output.verdict === "refuse_out_of_scope") {
    return [
      { label: "Retrieval", summary: "", active: false },
      { label: "Identity", summary: "", active: false },
      { label: "Reasoning", summary: "", active: false },
      { label: "Gate", summary: "", active: false },
      { label: "Verdict", summary: verdictSummary(output), active: true, tone: verdictTone },
    ];
  }

  const top = output.retrieved_evidence[0];
  const headline =
    output.verdict === "resolve" ? humanize(output.root_cause) : output.owner;

  return [
    {
      label: "Retrieval",
      summary: top
        ? `${top.source} · ${output.top_similarity.toFixed(2)}`
        : "no page found",
      active: true,
    },
    { label: "Identity", summary: identitySummary(output.status_facts), active: true },
    {
      label: "Reasoning",
      summary: `${output.consistency_votes.agree} of ${output.consistency_votes.total} agreed · ${headline}`,
      active: true,
    },
    {
      label: "Gate",
      summary: `Sufficiency ${output.gate_signals.sufficiency === "pass" ? "✓" : "✗"} · Consistency ${output.gate_signals.consistency === "pass" ? "✓" : "✗"}`,
      active: true,
    },
    { label: "Verdict", summary: verdictSummary(output), active: true, tone: verdictTone },
  ];
}

export function PipelineTimeline({
  output,
  revealed,
}: {
  output: DiagnosisOutput | null; // null while the mock animation runs
  revealed: number; // 0..5, from usePipelineSchedule
}) {
  const stageCount = STAGE_LABELS.length;
  // The mock plays in FULL first. The real payload only "applies" — coloring the
  // verdict tile, graying a refuse's stages — once the animation completes (revealed
  // >= stageCount). So a backend faster than the 8s mock doesn't gray/color tiles
  // mid-animation; the retroactive transition lands cleanly at the end (edge 1 & 3).
  const applied = revealed >= stageCount ? output : null;
  const tiles = buildTiles(applied);
  const isRefuse = applied?.verdict === "refuse_out_of_scope";
  const interactive = applied !== null; // summaries exist only once the payload applies
  // Default the open summary to the verdict tile so the outcome lands without a click.
  const [openTile, setOpenTile] = useState<number>(stageCount - 1);
  const fullyRevealed = revealed >= stageCount;

  const open = tiles[openTile];
  const showSummary = interactive && open?.active && openTile < revealed && open.summary;

  return (
    <div>
      <p className="mb-sm font-display text-displaySm italic lowercase text-text-muted">
        {interactive ? "how it got here" : "diagnosing…"}
      </p>

      {/* Tile row — horizontal, scrolls on narrow widths. Tiles + arrows reveal one
          by one as `revealed` increments (the mock schedule). */}
      <div className="flex items-center gap-xs overflow-x-auto pb-xs">
        {tiles.map((tile, i) => {
          if (i >= revealed) return null;
          const isVerdict = !!tile.tone;
          const selected = interactive && openTile === i;
          const base =
            "shrink-0 rounded-md border px-sm py-xs text-sm motion-safe:animate-[fadeIn_250ms_ease-out] motion-safe:transition-[opacity,color,background-color,border-color] motion-safe:duration-300";
          const cls = !tile.active
            ? "border-border/60 text-text-muted opacity-60" // skipped (refuse)
            : isVerdict
              ? TILE_TONE[tile.tone!]
              : `border-border bg-background-secondary ${selected ? "text-text-primary" : "text-text-secondary"} ${interactive ? "hover:text-text-primary" : ""}`;
          const clickable = interactive && tile.active;
          return (
            <div key={tile.label} className="flex shrink-0 items-center gap-xs">
              {i > 0 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => clickable && setOpenTile(i)}
                disabled={!clickable}
                aria-pressed={selected}
                className={`${base} ${cls} ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                {tile.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Refuse: one shared short-circuit indicator under the grayed group. */}
      {isRefuse && fullyRevealed && (
        <p className="mt-sm text-sm text-text-muted">
          ↳ Pipeline short-circuited — request out of scope, so retrieval, identity,
          reasoning, and the gate were not engaged.
        </p>
      )}

      {/* Active-tile summary line (resolve/escalate; or the refuse verdict tile). */}
      {showSummary && (
        <p className="mt-sm text-sm text-text-secondary">
          <span className="font-mono text-monoLabel uppercase tracking-monoLabel text-text-muted">
            {open.label}
          </span>{" "}
          <span className="font-mono text-monoValue">{open.summary}</span>
        </p>
      )}
    </div>
  );
}

// The CTA — pivots to admin with this ticket pre-selected. Rendered BELOW the answer
// (SID-90-revise layout), so it's a separate export from the tiles above the answer.
export function PipelineCTA({
  output,
  onAdvance,
}: {
  output: DiagnosisOutput;
  onAdvance: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdvance}
      className="inline-flex items-center gap-xs text-sm text-accent transition-opacity hover:opacity-80"
    >
      {ctaLabel(output)}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}

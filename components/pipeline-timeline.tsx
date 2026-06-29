"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { StatusFacts } from "@/lib/retrieval";

// SID-90 Pipeline Timeline — surfaces the system's pipeline in END-USER view so the
// architectural aha lands without a toggle. Five tiles, revealed by the existing
// paced reveal (useTraceReveal, driven from the page), each clickable for a one-line
// outcome summary. NOT the full reasoning trace — these are headlines that point to
// admin view for the full article. No streaming, no backend changes: every summary
// is derived from fields already in the DiagnosisOutput payload (same derivations as
// the admin reasoning-trace, kept consistent).
//
// Honesty: a refuse_out_of_scope payload carries ONLY {verdict, refuse_reason,
// missing_info} — the access-diagnosis stages don't drive a scope refusal and aren't
// in the payload. So for refuse, tiles 1–4 render grayed/skipped under a single
// "pipeline short-circuited" indicator (mirroring the admin trace's refuse collapse),
// and only the verdict tile is active.

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

type Tile = {
  label: string;
  summary: string;
  active: boolean;
  tone?: Tone;
};

// CTA copy — verdict-specific so the destination promise is honest: an escalate has
// an escalation package; a resolve has a reasoning trace; a refuse has the grounding
// it couldn't establish. Same admin destination, accurate framing per verdict.
function ctaLabel(output: DiagnosisOutput): string {
  if (output.verdict === "escalate") return "See the full escalation package";
  if (output.verdict === "resolve") return "See the full reasoning trace";
  return "See why this couldn't be grounded";
}

function verdictSummary(output: DiagnosisOutput): string {
  if (output.verdict === "resolve") return `Resolved · ${humanize(output.root_cause)}`;
  if (output.verdict === "escalate") return `Escalated · ${output.owner}`;
  return output.refuse_reason === "out_of_scope"
    ? "Refused · out of scope"
    : `Needs detail${output.missing_info ? ` · ${output.missing_info}` : ""}`;
}

function buildTiles(output: DiagnosisOutput): Tile[] {
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
  onOpenAdmin,
}: {
  output: DiagnosisOutput;
  revealed: number; // 0..5, from the paced reveal
  onOpenAdmin: () => void;
}) {
  const tiles = buildTiles(output);
  const isRefuse = output.verdict === "refuse_out_of_scope";
  // Default the open summary to the verdict tile so the outcome lands without a click;
  // clicking any active tile swaps to its summary.
  const [openTile, setOpenTile] = useState<number>(tiles.length - 1);
  const fullyRevealed = revealed >= tiles.length;

  const open = tiles[openTile];
  const showSummary = open?.active && openTile < revealed && open.summary;

  return (
    <div className="mt-md border-t border-border pt-md">
      <p className="mb-sm font-display text-displaySm italic lowercase text-text-muted">
        how it got here
      </p>

      {/* Tile row — horizontal, scrolls on narrow widths. Tiles + arrows reveal one
          by one as `revealed` increments. */}
      <div className="flex items-center gap-xs overflow-x-auto pb-xs">
        {tiles.map((tile, i) => {
          if (i >= revealed) return null;
          const isVerdict = !!tile.tone;
          const selected = openTile === i;
          const base =
            "shrink-0 rounded-md border px-sm py-xs text-sm transition-colors motion-safe:animate-[fadeIn_250ms_ease-out]";
          const cls = !tile.active
            ? "border-border/60 text-text-muted opacity-60" // skipped (refuse)
            : isVerdict
              ? TILE_TONE[tile.tone!]
              : `border-border bg-background-secondary text-text-secondary hover:text-text-primary ${selected ? "text-text-primary" : ""}`;
          return (
            <div key={tile.label} className="flex shrink-0 items-center gap-xs">
              {i > 0 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => tile.active && setOpenTile(i)}
                disabled={!tile.active}
                aria-pressed={selected}
                className={`${base} ${cls} ${tile.active ? "cursor-pointer" : "cursor-default"}`}
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

      {/* CTA — pivot to admin with this ticket pre-selected, once fully revealed. */}
      {fullyRevealed && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="mt-md inline-flex items-center gap-xs text-sm text-accent transition-opacity hover:opacity-80"
        >
          {ctaLabel(output)}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

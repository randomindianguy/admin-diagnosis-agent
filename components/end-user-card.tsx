"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, AlertTriangle, Info, Loader2 } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";
import { usePrefersReducedMotion } from "@/hooks/use-trace-reveal";

// End-user card (SID-49 B; SID-59). ONE persistent card that spans the whole
// submitted lifecycle — it renders the loading state and the verdict from the
// SAME subtree, so the Filed → Checked → [third] timeline progresses DURING the
// wait and then resolves in place rather than appearing retroactively with the
// answer. Mounted keyed by submitKey in the page, so it persists across
// loading→verdict (continuity) and resets per submission.
//
// HONESTY LINE (load-bearing): the timeline's third dot reflects ACTUAL state.
// Resolve/refuse fill it on the real API return; escalate leaves it HOLLOW —
// the agent's work is done, but the admin's hasn't started (a genuinely-future
// state we don't pretend is complete).

type Accent = "brand" | "warning" | "muted";

type Step = { lit: boolean; label: string; chip?: string };

interface CardContent {
  accent: Accent;
  pillIcon: ReactNode;
  pillClass: string;
  pillLabel: string;
  headline: string;
  steps: Step[];
  body: string;
  nextStep: string;
}

// "support-team" → "Support team" (and grammatical variants), so body copy reads
// naturally for every canonical owner.
function ownerLabel(owner: string): string {
  const map: Record<string, string> = {
    "identity-team": "Identity team",
    "security-team": "Security team",
    "support-team": "Support team",
    "resource-owner": "resource owner",
    "human-reviewer": "human reviewer",
  };
  return map[owner] ?? owner;
}

// --- Timeline — Filed → Checked → [third] across every verdict (SID-59). Lit
// dots fill in the verdict accent; the unlit dot is a hollow ring. The dot is a
// SINGLE element whose fill animates (motion-safe:transition-colors), so the
// third dot fills in place on the API return. Keyed by INDEX, not label, so a
// dot persists across its label changing (loading "" → verdict label) and keeps
// its transition. ---
function Dot({ lit, accent }: { lit: boolean; accent: Accent }) {
  const fill =
    accent === "brand"
      ? "bg-brand-primary"
      : accent === "warning"
        ? "bg-state-warning"
        : "bg-text-muted";
  return (
    <span
      className={`h-[10px] w-[10px] shrink-0 rounded-full border motion-safe:transition-colors motion-safe:duration-300 ${
        lit ? `${fill} border-transparent` : "border-text-muted bg-transparent"
      }`}
    />
  );
}

function Timeline({ steps, accent }: { steps: Step[]; accent: Accent }) {
  return (
    <div className="flex items-start">
      {steps.map((s, i) => (
        // Index key (not label): the third dot keeps its identity when its label
        // resolves from "" (loading) to the verdict label, so the fill animates.
        <div key={i} className="flex items-start">
          <div className="flex w-24 flex-col items-center gap-xs">
            <Dot lit={s.lit} accent={accent} />
            {s.label && (
              <span className="text-center text-sm leading-tight text-text-secondary">
                {s.label}
              </span>
            )}
            {s.chip && (
              <span className="rounded-pill border border-border px-sm py-[1px] text-sm text-text-secondary">
                {s.chip}
              </span>
            )}
          </div>
          {i < steps.length - 1 && (
            <span className="mt-[5px] h-px w-8 shrink-0 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Verdict content. Every verdict is Filed → Checked → [third] (SID-59); the
// third dot fills for resolve/refuse and stays hollow for escalate. ---
function content(output: DiagnosisOutput): CardContent {
  if (output.verdict === "resolve") {
    // SID-56: resolve = the user gets their answer directly. No ticket created.
    return {
      accent: "brand",
      pillIcon: <Check size={16} aria-hidden />,
      pillClass: "bg-brand-primary text-text-inverse",
      pillLabel: "Answered",
      headline: "Here's your answer.",
      steps: [
        { lit: true, label: "Filed" },
        { lit: true, label: "Checked" },
        { lit: true, label: "Answered" },
      ],
      body: output.diagnosis_text,
      nextStep:
        "If that doesn't get you unblocked, reply with more detail and I'll take another look.",
    };
  }
  if (output.verdict === "escalate") {
    // SID-56: escalate = ticket created, full evidence attached for the admin.
    // The third dot stays HOLLOW — the admin's review is genuinely future.
    const team = ownerLabel(output.owner);
    return {
      accent: "warning",
      pillIcon: <AlertTriangle size={16} aria-hidden />,
      pillClass: "bg-state-warning text-surface-dark",
      pillLabel: "Submitted",
      headline: "Submitted to your admin.",
      steps: [
        { lit: true, label: "Filed" },
        { lit: true, label: "Submitted", chip: team },
        { lit: false, label: "Admin reviews" },
      ],
      body:
        `I've sent your ${team} the full investigation — what you're trying to reach, your current access, and what I found. ` +
        "You won't need to re-explain it.",
      // Honesty (SID-56 Phase 3): no time commitment — the agent doesn't know the
      // admin's SLA. Vague-but-true beats a number it can't stand behind.
      nextStep: "They'll follow up with you — you'll hear back soon.",
    };
  }
  // refuse — three SIBLING shapes (SID-56 Phase 2). SID-59 normalizes all three to
  // the Filed → Checked → [third] timeline; the third dot fills (the agent's work
  // concluded with a clear outcome the user can act on).
  if (output.refuse_reason === "resource_ambiguity") {
    return {
      accent: "muted",
      pillIcon: <Info size={16} aria-hidden />,
      pillClass: "border border-border bg-background-primary text-text-secondary",
      pillLabel: "Need a bit more",
      // Beat 1 — authored lead; Beat 2 (body) = the model's missing_info ask.
      headline: "Checked your access — before I can be sure, I need a bit more.",
      steps: [
        { lit: true, label: "Filed" },
        { lit: true, label: "Checked" },
        { lit: true, label: "Needs detail" },
      ],
      body:
        output.missing_info ??
        "There's more than one resource this could be. Which one are you trying to open?",
      nextStep: "Add that detail and submit again — I'll pick up from there.",
    };
  }
  if (output.refuse_reason === "intent_ambiguity") {
    return {
      accent: "muted",
      pillIcon: <Info size={16} aria-hidden />,
      pillClass: "border border-border bg-background-primary text-text-secondary",
      pillLabel: "Need a bit more",
      headline: "Need a bit more before I can dig in.",
      steps: [
        { lit: true, label: "Filed" },
        { lit: true, label: "Checked" },
        { lit: true, label: "Needs detail" },
      ],
      body:
        output.missing_info ??
        "Access issues can mean different things. What were you trying to do?",
      nextStep: "Add that detail and submit again — I'll take it from there.",
    };
  }
  // out_of_scope — terminal; routed nowhere, the user goes to the helpdesk.
  return {
    accent: "muted",
    pillIcon: <Info size={16} aria-hidden />,
    pillClass: "border border-border bg-background-primary text-text-secondary",
    pillLabel: "Not handled here",
    headline: "This needs a different team.",
    steps: [
      { lit: true, label: "Filed" },
      { lit: true, label: "Checked" },
      { lit: true, label: "Out of scope" },
    ],
    body:
      "Your question is outside what this system can diagnose. Nothing has been " +
      "routed automatically — you'll need to reach out to your IT helpdesk directly.",
    nextStep: "Contact your IT helpdesk to get started.",
  };
}

// --- Loading content. Same card shell, no verdict yet: Filed lights at submit,
// Checked at ~400ms; the third dot is hollow with no label (we don't know the
// verdict). The synchronized loading text rides in the headline. ---
type LoadingPhase = "filed" | "checked";

function loadingContent(phase: LoadingPhase): CardContent {
  return {
    accent: "brand",
    pillIcon: <Loader2 size={16} aria-hidden className="motion-safe:animate-spin" />,
    pillClass: "border border-border bg-background-primary text-text-secondary",
    pillLabel: "Working",
    headline:
      phase === "filed" ? "Filing your request…" : "Checking your access…",
    steps: [
      { lit: true, label: "Filed" },
      { lit: phase === "checked", label: "Checked" },
      { lit: false, label: "" }, // third resolves on the verdict
    ],
    body: "",
    nextStep: "",
  };
}

export function EndUserCard({ output }: { output: DiagnosisOutput | null }) {
  const reduced = usePrefersReducedMotion();
  // Time-paced loading: Filed at mount, Checked ~400ms later. Reduced-motion
  // snaps straight to "checked" (both lit, no stagger) via the initial state —
  // no setState needed. The card remounts per submission (keyed by submitKey in
  // the page), so the initial phase is correct each time and the timer re-arms.
  const [phase, setPhase] = useState<LoadingPhase>(reduced ? "checked" : "filed");
  useEffect(() => {
    if (reduced) return; // already "checked" from the initializer
    const t = setTimeout(() => setPhase("checked"), 400);
    return () => clearTimeout(t);
  }, [reduced]);

  const c = output ? content(output) : loadingContent(phase);
  const settled = output !== null;

  return (
    <div className="flex flex-col gap-md">
      <OutcomeCard>
        <div className="flex flex-col gap-lg">
          {/* Status pill — top-left. Morphs from the loading pill to the verdict. */}
          <div>
            <span
              className={`inline-flex items-center gap-xs rounded-pill px-md py-xs ${c.pillClass}`}
            >
              {c.pillIcon}
              {c.pillLabel}
            </span>
          </div>

          {/* Headline — carries the synchronized loading text, then the verdict. */}
          <h2 className="text-text-primary">{c.headline}</h2>

          {/* Timeline — the band that progresses during the wait. */}
          <Timeline steps={c.steps} accent={c.accent} />

          {/* Body + next-step appear only on the verdict, and fade in AFTER the
              third dot has filled (250ms delay, held hidden via `both`). */}
          {settled && c.body && (
            <p className="text-text-secondary motion-safe:animate-[fadeIn_250ms_ease-out_250ms_both]">
              {c.body}
            </p>
          )}
          {settled && c.nextStep && (
            <p className="text-sm text-text-muted motion-safe:animate-[fadeIn_250ms_ease-out_350ms_both]">
              {c.nextStep}
            </p>
          )}
        </div>
      </OutcomeCard>
    </div>
  );
}

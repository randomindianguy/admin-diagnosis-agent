"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, AlertTriangle, Info, Loader2 } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { SubmissionStatus } from "@/lib/store";
import { OutcomeCard } from "./outcome-card";
import { usePrefersReducedMotion } from "@/hooks/use-trace-reveal";

// End-user card (SID-49 B; SID-59). ONE persistent card that spans the whole
// submitted lifecycle — it renders the loading state and the verdict from the
// SAME subtree, so the card morphs in place (loading pill + text → verdict pill +
// answer) rather than appearing retroactively. Mounted keyed by submitKey in the
// page, so it persists across loading→verdict (continuity) and resets per submission.
//
// SID-90 follow-on: the Filed → Checked → [third] lifecycle stepper was removed —
// it visually mirrored the pipeline timeline ("how it got here") rendered below the
// card and read as the same thing twice. The verdict pill + prose response carry the
// operational state; the pipeline timeline is the load-bearing aha surface. During
// loading, the pill (spinner) + the synchronized headline ("Filing…" → "Checking…")
// still convey progression.

interface CardContent {
  pillIcon: ReactNode;
  pillClass: string;
  pillLabel: string;
  headline: string;
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

// --- Verdict content. Pill + headline + body + next-step per verdict. ---
function content(output: DiagnosisOutput): CardContent {
  if (output.verdict === "resolve") {
    // SID-56: resolve = the user gets their answer directly. No ticket created.
    return {
      pillIcon: <Check size={16} aria-hidden />,
      pillClass:
        "border border-verdict-resolve/40 bg-verdict-resolve/10 text-verdict-resolve",
      pillLabel: "Answered",
      headline: "Here's your answer.",
      body: output.diagnosis_text,
      nextStep:
        "If that doesn't get you unblocked, reply with more detail and I'll take another look.",
    };
  }
  if (output.verdict === "escalate") {
    // SID-56: escalate = ticket created, full evidence attached for the admin.
    const team = ownerLabel(output.owner);
    return {
      pillIcon: <AlertTriangle size={16} aria-hidden />,
      pillClass:
        "border border-verdict-escalate/40 bg-verdict-escalate/10 text-verdict-escalate",
      pillLabel: "Submitted",
      headline: "Submitted to your admin.",
      body:
        `I've sent your ${team} the full investigation — what you're trying to reach, your current access, and what I found. ` +
        "You won't need to re-explain it.",
      // Honesty (SID-56 Phase 3): no time commitment — the agent doesn't know the
      // admin's SLA. Vague-but-true beats a number it can't stand behind.
      nextStep: "They'll follow up with you — you'll hear back soon.",
    };
  }
  // refuse — three SIBLING shapes (SID-56 Phase 2).
  if (output.refuse_reason === "resource_ambiguity") {
    return {
      pillIcon: <Info size={16} aria-hidden />,
      pillClass: "border border-border bg-background-primary text-text-secondary",
      pillLabel: "Need a bit more",
      // Beat 1 — authored lead; Beat 2 (body) = the model's missing_info ask.
      headline: "Checked your access — before I can be sure, I need a bit more.",
      body:
        output.missing_info ??
        "There's more than one resource this could be. Which one are you trying to open?",
      nextStep: "Add that detail and submit again — I'll pick up from there.",
    };
  }
  if (output.refuse_reason === "intent_ambiguity") {
    return {
      pillIcon: <Info size={16} aria-hidden />,
      pillClass: "border border-border bg-background-primary text-text-secondary",
      pillLabel: "Need a bit more",
      headline: "Need a bit more before I can dig in.",
      body:
        output.missing_info ??
        "Access issues can mean different things. What were you trying to do?",
      nextStep: "Add that detail and submit again — I'll take it from there.",
    };
  }
  // out_of_scope — terminal; routed nowhere, the user goes to the helpdesk.
  return {
    pillIcon: <Info size={16} aria-hidden />,
    pillClass: "border border-border bg-background-primary text-text-secondary",
    pillLabel: "Not handled here",
    headline: "This needs a different team.",
    body:
      "Your question is outside what this system can diagnose. Nothing has been " +
      "routed automatically — you'll need to reach out to your IT helpdesk directly.",
    nextStep: "Contact your IT helpdesk to get started.",
  };
}

// --- Loading content. Same card shell, no verdict yet: the pill spins and the
// headline rides the phase ("Filing…" at submit → "Checking…" at ~400ms). ---
type LoadingPhase = "filed" | "checked";

function loadingContent(phase: LoadingPhase): CardContent {
  return {
    pillIcon: <Loader2 size={16} aria-hidden className="motion-safe:animate-spin" />,
    pillClass: "border border-border bg-background-primary text-text-secondary",
    pillLabel: "Working",
    headline:
      phase === "filed" ? "Filing your request…" : "Checking your access…",
    body: "",
    nextStep: "",
  };
}

// SID-70: the closed-loop follow-up line for an escalate, rendered IN PLACE of the
// default next-step. Quiet (next-step weight); links open in a new tab. SID-75:
// keyed on the action TYPE, not status — team_routing shows its destination; an
// add_to_group card stays the frozen submit-moment (next-step + persistent Slack
// routing record) for every status, and the terminal approved/denied outcome moves
// to ApprovalResultCard. Returns null for non-escalate → the default next-step shows.
function approvalLine(
  output: DiagnosisOutput,
  status: SubmissionStatus | undefined,
  nextStep: string,
): ReactNode | null {
  if (output.verdict !== "escalate" || !status) return null;
  const linkCls = "text-accent underline-offset-2 hover:underline";

  const aa = output.approval_action;

  // team_routing — out-of-band; the destination + its Slack conversation link.
  if (aa?.type === "team_routing") {
    const team = ownerLabel(aa.team);
    const link = aa.slack_permalink;
    return (
      <p className="text-sm text-text-muted">
        Routed to {team}.{" "}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className={linkCls}>
            View conversation in Slack →
          </a>
        )}
      </p>
    );
  }

  // add_to_group — SID-75: this card is now the FROZEN submit-moment. It keeps the
  // next-step + the persistent Slack routing record for EVERY status; the terminal
  // outcome (approved/denied) renders as a separate ApprovalResultCard below, so it
  // is NOT shown inline here. (Pre-SID-75 the card mutated in place on approval.)
  if (aa?.type === "add_to_group") {
    const slack = aa.slack_permalink;
    return (
      <div className="flex flex-col gap-xs">
        {nextStep && (
          <p className="text-sm text-text-muted motion-safe:animate-[fadeIn_250ms_ease-out_350ms_both]">
            {nextStep}
          </p>
        )}
        {slack && (
          <p className="text-sm text-text-muted">
            Routing record ·{" "}
            <a href={slack} target="_blank" rel="noopener noreferrer" className={linkCls}>
              View in Slack →
            </a>
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function EndUserCard({
  output,
  status,
}: {
  output: DiagnosisOutput | null;
  status?: SubmissionStatus;
}) {
  const reduced = usePrefersReducedMotion();
  // Time-paced loading headline: Filed at mount, Checked ~400ms later. Reduced-motion
  // snaps straight to "checked" via the initial state — no setState needed. The card
  // remounts per submission (keyed by submitKey in the page), so the initial phase is
  // correct each time and the timer re-arms.
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
              className={`inline-flex items-center gap-xs rounded-sm px-md py-xs ${c.pillClass}`}
            >
              {c.pillIcon}
              {c.pillLabel}
            </span>
          </div>

          {/* Headline — the end-user verdict moment, in display serif (SID-67).
              Carries the synchronized loading text, then the verdict statement. */}
          <h2 className="font-display text-[22px] font-medium leading-heading tracking-display text-text-primary [text-wrap:balance]">
            {c.headline}
          </h2>

          {/* Body + next-step appear only on the verdict, and fade in on the API
              return (250ms delay, held hidden via `both`). */}
          {settled && c.body && (
            <p className="text-text-secondary [text-wrap:pretty] motion-safe:animate-[fadeIn_250ms_ease-out_250ms_both]">
              {c.body}
            </p>
          )}
          {/* SID-70: once an escalate has a downstream status, its follow-up line
              (approved + Notion link / denied / routed + Slack link) replaces the
              default next-step. Other states keep the default next-step. */}
          {settled &&
            output &&
            (approvalLine(output, status, c.nextStep) ??
              (c.nextStep ? (
                <p className="text-sm text-text-muted motion-safe:animate-[fadeIn_250ms_ease-out_350ms_both]">
                  {c.nextStep}
                </p>
              ) : null))}
        </div>
      </OutcomeCard>
    </div>
  );
}

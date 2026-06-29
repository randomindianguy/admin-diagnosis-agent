"use client";

import { type ReactNode } from "react";
import { Check, AlertTriangle, Info } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import type { SubmissionStatus } from "@/lib/store";
import { OutcomeCard } from "./outcome-card";
import { PipelineTimeline, PipelineCTA } from "./pipeline-timeline";
import { PIPELINE_STAGES } from "@/hooks/use-pipeline-schedule";

// End-user card (SID-49 B; SID-59). The verdict moment: pill + headline + answer.
//
// SID-90-revise: the pipeline timeline now sits ABOVE the answer and IS the loading
// state — it animates on the mock schedule during the diagnose wait (the verdict
// tile holds uncolored until the real response lands), then the answer fades in
// below. The old loading pill + "Filing…/Checking…" stepper are gone (the timeline
// carries the wait). Card order: timeline → hairline → verdict pill + answer →
// verdict-specific CTA. The timeline only renders for the LIVE/current answer
// (showTimeline, set by the page); past tickets render the answer alone.
//
// `revealed` (0..PIPELINE_STAGES) is driven page-side by usePipelineSchedule and
// passed in, so it survives the pending→settled card swap. The answer is gated on
// the timeline FINISHING (revealed >= PIPELINE_STAGES): a backend faster than the
// 8s mock still plays the full animation before the answer appears.

type Accent = "resolve" | "escalate" | "neutral";

interface CardContent {
  accent: Accent;
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
    return {
      accent: "resolve",
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
    const team = ownerLabel(output.owner);
    return {
      accent: "escalate",
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
      accent: "neutral",
      pillIcon: <Info size={16} aria-hidden />,
      pillClass: "border border-border bg-background-primary text-text-secondary",
      pillLabel: "Need a bit more",
      headline: "Checked your access — before I can be sure, I need a bit more.",
      body:
        output.missing_info ??
        "There's more than one resource this could be. Which one are you trying to open?",
      nextStep: "Add that detail and submit again — I'll pick up from there.",
    };
  }
  if (output.refuse_reason === "intent_ambiguity") {
    return {
      accent: "neutral",
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
    accent: "neutral",
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

  // add_to_group — SID-75: this card is the FROZEN submit-moment. It keeps the
  // next-step + the persistent Slack routing record for EVERY status; the terminal
  // outcome (approved/denied) renders as a separate ApprovalResultCard below.
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
  showTimeline = false,
  revealed = PIPELINE_STAGES,
  onOpenAdmin,
}: {
  output: DiagnosisOutput | null;
  status?: SubmissionStatus;
  showTimeline?: boolean; // SID-90-revise: only the live/current answer animates
  revealed?: number; // 0..PIPELINE_STAGES, from usePipelineSchedule (page-side)
  onOpenAdmin?: () => void;
}) {
  const settled = output !== null;
  // The answer waits for the timeline to finish (edge case 1: a fast backend still
  // plays the full mock). Non-timeline cards (past tickets) show the answer as soon
  // as they're settled. Reduced-motion: revealed is already PIPELINE_STAGES.
  const answerVisible = showTimeline ? settled && revealed >= PIPELINE_STAGES : settled;
  const c = output ? content(output) : null;

  return (
    <div className="flex flex-col gap-md">
      <OutcomeCard>
        <div className="flex flex-col gap-lg">
          {/* Timeline — ABOVE the answer, animates during the wait (the loading
              state itself), then colors from the payload. */}
          {showTimeline && (
            <PipelineTimeline output={output} revealed={revealed} />
          )}

          {/* Answer block — pill + headline + body + next-step + CTA. Gated so it
              appears only after the timeline completes. A hairline separates it from
              the timeline above. */}
          {answerVisible && c && output && (
            <div
              className={`flex flex-col gap-lg ${showTimeline ? "border-t border-border pt-lg" : ""}`}
            >
              {/* Status pill — the verdict. */}
              <div>
                <span
                  className={`inline-flex items-center gap-xs rounded-sm px-md py-xs ${c.pillClass}`}
                >
                  {c.pillIcon}
                  {c.pillLabel}
                </span>
              </div>

              {/* Headline — the end-user verdict moment, display serif (SID-67). */}
              <h2 className="font-display text-[22px] font-medium leading-heading tracking-display text-text-primary [text-wrap:balance]">
                {c.headline}
              </h2>

              {/* Body. */}
              {c.body && (
                <p className="text-text-secondary [text-wrap:pretty]">{c.body}</p>
              )}

              {/* SID-70: escalate follow-up line (routed/approved/denied) replaces
                  the default next-step; other states keep the default. */}
              {approvalLine(output, status, c.nextStep) ??
                (c.nextStep ? (
                  <p className="text-sm text-text-muted">{c.nextStep}</p>
                ) : null)}

              {/* SID-90-revise: verdict-specific CTA, BELOW the answer. */}
              {showTimeline && onOpenAdmin && (
                <PipelineCTA output={output} onOpenAdmin={onOpenAdmin} />
              )}
            </div>
          )}
        </div>
      </OutcomeCard>
    </div>
  );
}

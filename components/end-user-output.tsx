import { Fragment, type ReactNode } from "react";
import { Check, AlertTriangle, Info } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import { OutcomeCard } from "./outcome-card";

// End-user view (SID-49 B). Status-page timeline shape — what the end user sees
// as a ticket update once the diagnosis lands. JTBD: avoid helplessness (P6) —
// confirmation it was processed + an honest timeline + the next step.
//
// HONESTY LINE (load-bearing): at T+0 the agent knows what the SYSTEM did and
// what's queued — it does NOT know what humans downstream have done. No copy here
// claims downstream-actor behavior; downstream is always future/conditional.

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

// --- Disclosure banner (B.4) — end-user only. Tells the HM the simplification is
// JTBD-driven, not role-based gating. ---
function DisclosureBanner() {
  return (
    <div className="flex items-start gap-sm rounded-md border border-border bg-background-secondary px-md py-sm text-sm text-text-secondary">
      <Info size={16} aria-hidden className="mt-[2px] shrink-0" />
      <p>
        End-user view — what the person who&rsquo;s blocked sees. Toggle to Admin
        for the escalation package: the full gate-by-gate investigation an admin
        receives.
      </p>
    </div>
  );
}

// --- Timeline (B.5) — lit dots filled in the verdict accent; unlit dots hollow.
// Fixed-width columns + fixed connectors so a 2-dot (refuse) timeline is visibly
// SHORTER than a 3-dot one (natural mapping: fewer queued steps = shorter). ---
function Dot({ lit, accent }: { lit: boolean; accent: Accent }) {
  if (!lit) {
    return (
      <span className="h-2 w-2 shrink-0 rounded-full border border-text-muted" />
    );
  }
  const fill =
    accent === "brand"
      ? "bg-brand-primary"
      : accent === "warning"
        ? "bg-state-warning"
        : "bg-text-muted";
  return <span className={`h-[10px] w-[10px] shrink-0 rounded-full ${fill}`} />;
}

function Timeline({ steps, accent }: { steps: Step[]; accent: Accent }) {
  return (
    <div className="flex items-start">
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          <div className="flex w-24 flex-col items-center gap-xs">
            <Dot lit={s.lit} accent={accent} />
            <span className="text-center text-sm leading-tight text-text-secondary">
              {s.label}
            </span>
            {s.chip && (
              <span className="rounded-pill border border-border px-sm py-[1px] text-sm text-text-secondary">
                {s.chip}
              </span>
            )}
          </div>
          {i < steps.length - 1 && (
            <span className="mt-[5px] h-px w-8 shrink-0 bg-border" />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function content(output: DiagnosisOutput): CardContent {
  if (output.verdict === "resolve") {
    // SID-56: resolve = the user gets their answer directly. No ticket created.
    // The body is the agent's actual finding (diagnosis_text), addressed to them.
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
      nextStep: "Watch for a follow-up from them — typically within 1 business day.",
    };
  }
  // refuse — two dots only; nothing is queued downstream (honest signal).
  return {
    accent: "muted",
    pillIcon: <Info size={16} aria-hidden />,
    pillClass: "border border-border bg-background-primary text-text-secondary",
    pillLabel: "Not handled here",
    headline: "This needs a different team.",
    steps: [
      { lit: true, label: "Filed" },
      { lit: true, label: "Not handled" },
    ],
    body:
      "Your question is outside what this system can diagnose. Nothing has been " +
      "routed automatically — you'll need to reach out to your IT helpdesk directly.",
    nextStep: "Contact your IT helpdesk to get started.",
  };
}

export function EndUserOutput({ output }: { output: DiagnosisOutput }) {
  const c = content(output);
  return (
    <div className="flex flex-col gap-md">
      <DisclosureBanner />
      <OutcomeCard>
        <div className="flex flex-col gap-lg">
          {/* Status pill — top-left. */}
          <div>
            <span
              className={`inline-flex items-center gap-xs rounded-pill px-md py-xs ${c.pillClass}`}
            >
              {c.pillIcon}
              {c.pillLabel}
            </span>
          </div>

          {/* Headline. */}
          <h2 className="text-text-primary">{c.headline}</h2>

          {/* Timeline — its own band. */}
          <Timeline steps={c.steps} accent={c.accent} />

          {/* Body — what the system did + what's queued. */}
          <p className="text-text-secondary">{c.body}</p>

          {/* Next-step — muted, smaller, separated. */}
          <p className="text-sm text-text-muted">{c.nextStep}</p>
        </div>
      </OutcomeCard>
    </div>
  );
}

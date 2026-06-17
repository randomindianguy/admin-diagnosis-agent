"use client";

import { useCallback, useEffect, useState } from "react";
import { DiagnosisInput } from "@/components/diagnosis-input";
import { DiagnosisOutput } from "@/components/diagnosis-output";
import { RefusalOutput } from "@/components/refusal-output";
import { EndUserOutput } from "@/components/end-user-output";
import { PreviousVerdictRow } from "@/components/previous-verdict-row";
import { ErrorState } from "@/components/error-state";
import { ReasoningTrace } from "@/components/reasoning-trace";
import { PersonaToggle, type PersonaView } from "@/components/persona-toggle";
import { ShieldIcon, GitHubIcon, SearchIcon } from "@/components/icons";
import { useDiagnose } from "@/hooks/use-diagnose";
import { useTraceReveal } from "@/hooks/use-trace-reveal";
import type { DiagnosisOutput as DiagnosisOutputT } from "@/lib/schema";

type Previous = { query: string; verdict: DiagnosisOutputT["verdict"] };

const REPO_URL = "https://github.com/randomindianguy/admin-diagnosis-agent";

// Admin reasoning trace = 7 steps (Scope check leads). Reveal mounts rows over
// ~3.5s; on resolve the values swap in (staggered); the card un-gates when the
// trace signals it's settled (SID-50).
const TOTAL_TRACE_ROWS = 7;

const GREETING =
  "Tell me what you're trying to access and what's happening. I'll check your " +
  "permissions, then get you unblocked, tell you what's missing, or hand it to " +
  "your admin with the full picture. Try this:";

// SID-56 Phase 1 — one end-user placeholder to validate the flow end-to-end. The
// query self-identifies (no auth in this demo, so identity comes from the message;
// a message without it is exactly the REFUSE-1 identity-ambiguity case in Phase 2).
// The full 5–6 synthetic descriptions land with REFUSE 1/2.
const SCENARIOS: { label: string; query: string }[] = [
  {
    label: "I can't open a shared folder",
    query:
      "I'm Maya on the data team and I can't open the Q3 Revenue Models folder in Drive.",
  },
];

// Scenario chips — shown in the initial state and re-revealed via "Try another
// scenario" after a submission. Click pre-fills the textarea (no auto-submit).
function ScenarioChips({
  onPick,
  disabled,
}: {
  onPick: (query: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-xs">
      {SCENARIOS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.query)}
          disabled={disabled}
          className="rounded-pill border border-border bg-background-secondary px-md py-xs text-text-secondary transition-colors hover:border-brand-primary hover:text-text-primary disabled:opacity-50"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [symptom, setSymptom] = useState("");
  // The query that produced the current result, and the prior result kept as a
  // slim row for "did rephrasing change anything" (UI-SPEC component 3).
  const [submitted, setSubmitted] = useState("");
  const [previous, setPrevious] = useState<Previous | null>(null);
  // Persona view (SID-49; reframed SID-56). End user is the PRIMARY persona and
  // default landing; "Admin" exposes the escalation-package view (trace + evidence).
  // The reasoning trace renders ONLY in the admin path — end users never see the
  // gate-by-gate (they get a simplified loading state). No persistence.
  const [personaView, setPersonaView] = useState<PersonaView>("end-user");
  // Two elapsed-time counters (SID-50): submitKey drives row MOUNT (stepMs=500);
  // resolveKey drives the value SWAP after the API resolves (stepMs=150).
  const [submitKey, setSubmitKey] = useState(0);
  const [resolveKey, setResolveKey] = useState(0);
  const [traceSettled, setTraceSettled] = useState(false);
  const revealedRowCount = useTraceReveal(submitKey, TOTAL_TRACE_ROWS);
  const swappedRowCount = useTraceReveal(resolveKey, TOTAL_TRACE_ROWS, 150);
  const handleSettled = useCallback(() => setTraceSettled(true), []);
  const diagnose = useDiagnose();

  // Start the value-swap reveal the moment the API resolves.
  useEffect(() => {
    if (diagnose.isSuccess && diagnose.data) setResolveKey((k) => k + 1);
  }, [diagnose.isSuccess, diagnose.data]);

  function handleSubmit() {
    const query = symptom.trim();
    if (query.length === 0 || diagnose.isPending) return;
    // Demote the current result to "previous" before issuing the next one.
    if (diagnose.data) {
      setPrevious({ query: submitted, verdict: diagnose.data.verdict });
    }
    setSubmitted(query);
    setTraceSettled(false); // re-gate the output card
    setSubmitKey((k) => k + 1); // start a fresh reveal
    diagnose.mutate(query);
  }

  return (
    <main className="flex h-screen w-full flex-col bg-background-primary text-text-primary">
      {/* Shared top bar — the persona toggle is the structural shell switch that
          swaps the body layout below (SID-56 1.5). Wordmark + GitHub + toggle live
          here so the toggle has one stable position across both layouts. */}
      <header className="flex items-center justify-between border-b border-border px-lg py-md">
        <div className="flex items-center gap-sm text-text-primary">
          <ShieldIcon className="h-6 w-6 text-brand-primary" />
          <span className="text-button">admin-diagnosis-agent</span>
        </div>
        <div className="flex items-center gap-md">
          <PersonaToggle value={personaView} onChange={setPersonaView} />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </div>
      </header>

      {personaView === "end-user" ? (
        // END-USER — focused single column (SID-56 1.5/polish): explainer + chip
        // FIRST, then the input (read, then act). Grounded ~16vh from the top so
        // it isn't floating against the top edge. No trace, no two-pane.
        <div className="flex min-h-0 flex-1 justify-center overflow-auto">
          <div className="flex w-full max-w-[480px] flex-col gap-lg px-md pb-2xl pt-[16vh]">
            {!submitted ? (
              <div className="flex flex-col gap-sm">
                <p className="text-text-secondary">{GREETING}</p>
                {/* Chip click populates the input below ("try this" affordance). */}
                <ScenarioChips onPick={setSymptom} disabled={diagnose.isPending} />
              </div>
            ) : diagnose.isPending ? (
              <p className="text-text-secondary">Checking your access…</p>
            ) : diagnose.isError ? (
              <ErrorState
                message={diagnose.error.message}
                onRetry={() => diagnose.mutate(submitted)}
              />
            ) : diagnose.data ? (
              <div className="motion-safe:animate-[fadeIn_250ms_ease-out]">
                <EndUserOutput output={diagnose.data} />
              </div>
            ) : null}

            <DiagnosisInput
              value={symptom}
              onChange={setSymptom}
              onSubmit={handleSubmit}
              disabled={diagnose.isPending}
            />
          </div>
        </div>
      ) : !diagnose.isPending && !diagnose.isError && !diagnose.data ? (
        // ADMIN, empty — review-only. Admins don't submit; they review what end
        // users submit. No intake panel here (SID-56 polish).
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm px-lg text-center">
          <SearchIcon className="h-8 w-8 text-text-muted" />
          <p className="max-w-[420px] text-text-secondary">
            Submit a request from the End user view — the escalation package will
            appear here.
          </p>
        </div>
      ) : (
        // ADMIN, active — two-pane escalation package: reasoning trace (left) +
        // evidence card (right). Review-only: no intake, no re-pick affordance.
        <div className="flex min-h-0 flex-1">
          <section className="flex w-1/2 flex-col gap-lg overflow-auto border-r border-border px-lg py-lg">
            <div className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand-primary px-md py-sm text-text-inverse">
                {submitted}
              </p>
            </div>
            {diagnose.isError ? (
              <p className="text-text-secondary">
                Couldn&rsquo;t complete — see the escalation package on the right.
              </p>
            ) : diagnose.isPending || diagnose.data ? (
              <ReasoningTrace
                key={submitKey}
                output={diagnose.isPending ? null : (diagnose.data ?? null)}
                revealedRowCount={revealedRowCount}
                swappedRowCount={swappedRowCount}
                onSettled={handleSettled}
              />
            ) : null}
          </section>

          <section className="flex w-1/2 flex-col gap-lg overflow-auto px-lg py-lg">
            {previous && (
              <PreviousVerdictRow
                query={previous.query}
                verdict={previous.verdict}
              />
            )}
            {diagnose.isError ? (
              <ErrorState
                message={diagnose.error.message}
                onRetry={() => diagnose.mutate(submitted)}
              />
            ) : diagnose.data && traceSettled ? (
              // Escalation package: left-pane trace + this evidence card = the
              // full investigation an admin opens. Un-gates after the trace settles.
              <div className="flex flex-col gap-md motion-safe:animate-[fadeIn_250ms_ease-out]">
                <p className="text-sm text-text-muted">
                  Escalation package — the full investigation an admin receives.
                </p>
                {diagnose.data.verdict === "refuse_out_of_scope" ? (
                  <RefusalOutput />
                ) : (
                  <DiagnosisOutput output={diagnose.data} />
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

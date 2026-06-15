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
  "I diagnose workspace access issues — why someone can't reach a resource, and " +
  "what to do about it. Ask me, or try one of these:";

// Five demo scenarios spanning the three verdicts (SID-48 1.2 / 3.3). Click
// pre-fills the textarea; auto-submit is deferred to Phase 3.3.
const SCENARIOS: { label: string; query: string }[] = [
  {
    label: "Diagnose · nested group",
    query: "Why can't Maya open Q3 Revenue Models? She's in data-team.",
  },
  {
    label: "Escalate · unknown entity",
    query:
      "Carlos can't see Q4 forecast files. He's in finance-leads and the group has access. What's wrong?",
  },
  {
    label: "Refuse · off-topic",
    query: "What's the weather in San Francisco today?",
  },
  {
    label: "Refuse · execution",
    query: "Can you reset Maya's password?",
  },
  {
    label: "Escalate · inquiry",
    query: "Who currently has access to the Q3 Revenue Models folder?",
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
  // Reveal the scenario chips again after a submission (collapsed by default once
  // the conversation starts — chips are primarily a "no query yet" affordance).
  const [showScenarios, setShowScenarios] = useState(false);
  // The query that produced the current result, and the prior result kept as a
  // slim row for "did rephrasing change anything" (UI-SPEC component 3).
  const [submitted, setSubmitted] = useState("");
  const [previous, setPrevious] = useState<Previous | null>(null);
  // Persona view (SID-49). Drives the right-pane + reasoning-trace rendering split
  // in Phase B; in Phase A it only powers the toggle. Default Admin, no persistence.
  const [personaView, setPersonaView] = useState<PersonaView>("admin");
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
    <main className="flex h-screen w-full bg-background-primary text-text-primary">
      {/* LEFT PANE — conversation / reasoning + input (SID-48 1.1/1.2) */}
      <section className="flex w-1/2 flex-col border-r border-border">
        {/* Wordmark + GitHub */}
        <header className="flex items-center justify-between border-b border-border px-lg py-md">
          <div className="flex items-center gap-sm text-text-primary">
            <ShieldIcon className="h-6 w-6 text-brand-primary" />
            <span className="text-button">admin-diagnosis-agent</span>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </header>

        {/* Left pane body: initial greeting+chips, or post-submission conversation. */}
        <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-auto px-lg py-lg">
          {!submitted ? (
            // No query yet — greeting + scenario chips.
            <>
              <p className="text-text-secondary">{GREETING}</p>
              <ScenarioChips onPick={setSymptom} disabled={diagnose.isPending} />
            </>
          ) : (
            // Post-submission — user bubble + reasoning trace + re-pick affordance.
            <>
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand-primary px-md py-sm text-text-inverse">
                  {submitted}
                </p>
              </div>

              {personaView === "end-user" ? (
                // End-user: no reasoning trace — a brief acknowledgment once done.
                diagnose.data ? (
                  <p className="text-text-secondary">Your request was processed.</p>
                ) : null
              ) : diagnose.isError ? (
                <p className="text-text-secondary">
                  Couldn&rsquo;t complete — see the error on the right.
                </p>
              ) : diagnose.isPending || diagnose.data ? (
                // Admin: sequential reveal DURING the call; ReasoningTrace handles
                // loading skeletons, the value swap, and the refuse snap.
                <ReasoningTrace
                  key={submitKey}
                  output={diagnose.isPending ? null : (diagnose.data ?? null)}
                  revealedRowCount={revealedRowCount}
                  swappedRowCount={swappedRowCount}
                  onSettled={handleSettled}
                />
              ) : null}

              <div className="flex flex-col gap-sm">
                <button
                  type="button"
                  onClick={() => setShowScenarios((v) => !v)}
                  className="self-start text-text-secondary transition-colors hover:text-text-primary"
                >
                  {showScenarios ? "Hide scenarios" : "Try another scenario"}
                </button>
                {showScenarios && (
                  <ScenarioChips onPick={setSymptom} disabled={diagnose.isPending} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Input pinned to the bottom of the left pane */}
        <div className="border-t border-border px-lg py-md">
          <DiagnosisInput
            value={symptom}
            onChange={setSymptom}
            onSubmit={handleSubmit}
            disabled={diagnose.isPending}
          />
        </div>
      </section>

      {/* RIGHT PANE — diagnosis output. Pinned header carries the persona toggle
          (SID-49 A.1: natural mapping — toggle sits where its effect renders). */}
      <section className="flex w-1/2 flex-col">
        <header className="flex items-center justify-end border-b border-border px-lg py-md">
          <PersonaToggle value={personaView} onChange={setPersonaView} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {!diagnose.isPending && !diagnose.isError && !diagnose.data ? (
            /* Empty state — centered, subtle icon + one muted line. */
            <div className="flex flex-1 flex-col items-center justify-center gap-sm px-lg text-center">
              <SearchIcon className="h-8 w-8 text-text-muted" />
              <p className="text-text-secondary">
                Pick a scenario, or describe an access issue.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-lg px-lg py-lg">
              {previous && (
                <PreviousVerdictRow
                  query={previous.query}
                  verdict={previous.verdict}
                />
              )}
              {personaView === "end-user" ? (
                diagnose.isPending ? (
                  // End-user loading: minimal status line, no sequential trace.
                  <p className="text-text-secondary">Working on your request…</p>
                ) : diagnose.isError ? (
                  <ErrorState
                    message={diagnose.error.message}
                    onRetry={() => diagnose.mutate(submitted)}
                  />
                ) : diagnose.data ? (
                  <div className="motion-safe:animate-[fadeIn_250ms_ease-out]">
                    <EndUserOutput output={diagnose.data} />
                  </div>
                ) : null
              ) : diagnose.isError ? (
                <ErrorState
                  message={diagnose.error.message}
                  onRetry={() => diagnose.mutate(submitted)}
                />
              ) : diagnose.data && traceSettled ? (
                // Admin: card un-gates only after the trace settles (last value
                // swapped, or refuse transition done). During the reveal the right
                // pane stays blank — the left-pane trace is the loading affordance.
                <div className="motion-safe:animate-[fadeIn_250ms_ease-out]">
                  {diagnose.data.verdict === "refuse_out_of_scope" ? (
                    <RefusalOutput />
                  ) : (
                    <DiagnosisOutput output={diagnose.data} />
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

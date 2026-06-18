"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DiagnosisInput } from "@/components/diagnosis-input";
import { DiagnosisOutput } from "@/components/diagnosis-output";
import { RefusalOutput } from "@/components/refusal-output";
import { EndUserCard } from "@/components/end-user-card";
import { UserBubble } from "@/components/user-bubble";
import { DisclosureBanner } from "@/components/disclosure-banner";
import { PreviousVerdictRow } from "@/components/previous-verdict-row";
import { ErrorState } from "@/components/error-state";
import { ReasoningTrace } from "@/components/reasoning-trace";
import { PersonaToggle, type PersonaView } from "@/components/persona-toggle";
import { ShieldIcon, GitHubIcon, SearchIcon } from "@/components/icons";
import { useDiagnose } from "@/hooks/use-diagnose";
import { useTraceReveal } from "@/hooks/use-trace-reveal";
import { useSubmissions, CURRENT_USER, makeId, type Turn } from "@/lib/store";
import type { DiagnosisOutput as DiagnosisOutputT } from "@/lib/schema";

type Previous = { query: string; verdict: DiagnosisOutputT["verdict"] };

const REPO_URL = "https://github.com/randomindianguy/admin-diagnosis-agent";

// Admin reasoning trace = 7 steps (Scope check leads). Reveal mounts rows over
// ~3.5s; on resolve the values swap in (staggered); the card un-gates when the
// trace signals it's settled (SID-50).
const TOTAL_TRACE_ROWS = 7;

// First-time-viewer guidance (SID-62 Q5) — one plain-language line, no jargon.
const GUIDANCE =
  "Start with a clear request to see a direct answer — then try a vague one to " +
  "watch the agent ask for more before it guesses.";

// SID-62 — six end-user scenarios for eyes-on, spanning the verdict shapes:
// four demonstrative (clean resolve, owner routing, escalate, refuse→resolve),
// Maya (seed-1 nested-inheritance resolve + evidence-page test), and an
// out-of-scope one. Click pre-fills the input (and resets any conversation).
const SCENARIOS: { label: string; query: string }[] = [
  {
    // resolve — already has access via group (existing_group_access)
    label: "I need the analytics dashboard",
    query: "I need access to the analytics dashboard.",
  },
  {
    // resolve — owner-controlled, route to owner (resource_owner_routing)
    label: "I can't open the Q3 strategy plan",
    query: "I can't open the Q3 strategy plan.",
  },
  {
    // escalate — onboarding provisioning gap (route to identity team)
    label: "New hire needs the data warehouse",
    query:
      "I joined the analytics team last week and need access to the data warehouse dashboards.",
  },
  {
    // refuse → resolve loop — vague resource ("which dashboard?")
    label: "I can't open the dashboard",
    query: "I can't open the dashboard.",
  },
  {
    // resolve — confident diagnosis (nested-subgroup inheritance gap)
    label: "I can't open a shared folder",
    query:
      "I'm Maya on the data team and I can't open the Q3 Revenue Models folder in Drive.",
  },
  {
    // out_of_scope — policy question, not an access diagnosis.
    label: "What's the password policy?",
    query: "What's the company policy on how often we have to reset passwords?",
  },
];

// Scenario chips — empty-state suggestions. Click resets any conversation and
// pre-fills the input (no auto-submit).
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
  // The query that produced the current result (admin bubble + retry), and the
  // prior result kept as a slim row for "did rephrasing change anything".
  const [submitted, setSubmitted] = useState("");
  const [previous, setPrevious] = useState<Previous | null>(null);
  const [personaView, setPersonaView] = useState<PersonaView>("end-user");
  // The id for the in-flight agent turn. Minted at submit and reused when the
  // turn is archived, so the loading card and the settled card share a key and
  // morph in place (SID-59). Non-null === a request is in flight / awaiting.
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  // Trace reveal counters (SID-50): submitKey drives row MOUNT; resolveKey the
  // value SWAP after the API resolves.
  const [submitKey, setSubmitKey] = useState(0);
  const [resolveKey, setResolveKey] = useState(0);
  const [traceSettled, setTraceSettled] = useState(false);
  const revealedRowCount = useTraceReveal(submitKey, TOTAL_TRACE_ROWS);
  const swappedRowCount = useTraceReveal(resolveKey, TOTAL_TRACE_ROWS, 150);
  const handleSettled = useCallback(() => setTraceSettled(true), []);
  const diagnose = useDiagnose();

  // Shared submissions store (SID-62). The end-user view drives the ACTIVE
  // conversation; SID-63's admin feed will read the full list.
  const submissions = useSubmissions((s) => s.submissions);
  const activeId = useSubmissions((s) => s.activeId);
  const startSubmission = useSubmissions((s) => s.startSubmission);
  const addUserTurn = useSubmissions((s) => s.addUserTurn);
  const addAgentTurn = useSubmissions((s) => s.addAgentTurn);
  const resetStore = useSubmissions((s) => s.reset);

  const active = submissions.find((s) => s.id === activeId) ?? null;
  const turns = active?.turns ?? [];

  // SID-56 Phase 2 (Option A): the two ambiguity refuses are end-user
  // clarification events — admin sees a compact note, not the trace.
  const data = diagnose.data;
  const isAmbiguityRefuse =
    data?.verdict === "refuse_out_of_scope" &&
    data.refuse_reason !== "out_of_scope";

  // Auto-scroll the transcript to the newest turn as the conversation grows.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, pendingAgentId, activeId]);

  // Issue a diagnosis. Archive the agent turn (and bump the swap reveal) in the
  // mutation's onSuccess — the idiomatic place, so no setState-in-effect.
  const runDiagnose = useCallback(
    (query: string, agentId: string) => {
      setTraceSettled(false);
      setSubmitKey((k) => k + 1);
      diagnose.mutate(query, {
        onSuccess: (output) => {
          addAgentTurn(output, agentId);
          setPendingAgentId(null);
          setResolveKey((k) => k + 1);
        },
      });
    },
    [diagnose, addAgentTurn],
  );

  function handleSubmit(text: string) {
    const q = text.trim();
    if (q.length === 0 || diagnose.isPending) return;

    // If the last agent turn was a clarifying refuse, this message is the
    // clarification — stitch it WITH the original so retrieval + the model see
    // the combined context (SID-62 Q2; backend stays single-shot).
    const agentTurns = turns.filter(
      (t): t is Extract<Turn, { role: "agent" }> => t.role === "agent",
    );
    const lastAgent = agentTurns[agentTurns.length - 1];
    const inRefuseLoop =
      lastAgent?.output.verdict === "refuse_out_of_scope" &&
      lastAgent.output.refuse_reason !== "out_of_scope";

    let query = q;
    if (inRefuseLoop && active) {
      const firstUser = active.turns.find(
        (t): t is Extract<Turn, { role: "user" }> => t.role === "user",
      );
      query = `Original request: "${firstUser?.text ?? ""}" Clarification: "${q}"`;
    }

    // Demote the current verdict to "previous" before issuing the next one.
    if (diagnose.data) {
      setPrevious({ query: submitted, verdict: diagnose.data.verdict });
    }
    if (!active) startSubmission(CURRENT_USER, q);
    else addUserTurn(q);

    const agentId = makeId("agent");
    setPendingAgentId(agentId);
    setSubmitted(query);
    setSymptom(""); // clear input on submit (standard chat behavior)
    runDiagnose(query, agentId);
  }

  // Reset to the empty home state. The submission persists in the store's feed
  // (the live-ingestion seam SID-63 reads) — only the active pointer clears.
  function handleReset() {
    resetStore();
    diagnose.reset();
    setPendingAgentId(null);
    setSymptom("");
    setSubmitted("");
    setPrevious(null);
    setTraceSettled(false);
  }

  // Chip click doubles as "start over from here": reset, then pre-fill.
  function handlePickChip(query: string) {
    handleReset();
    setSymptom(query);
  }

  return (
    <main className="flex h-screen w-full flex-col bg-background-primary text-text-primary">
      {/* Shared top bar — the persona toggle is the structural shell switch. */}
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
        // END-USER — chat (SID-62, revised): input pinned at the BOTTOM, the
        // conversation stream grows above it and auto-scrolls to the newest turn
        // (standard chat coherence — you respond where you read). The empty state
        // stacks WHAT → WHY → HOW (banner → guidance → chips) bottom-anchored
        // just above the input → action.
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
          <div className="flex min-h-0 w-full max-w-[480px] flex-col">
            {/* Scroll region above the input. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto px-md pt-lg">
              {active ? (
                <div className="flex flex-col gap-md">
                  {turns.map((t) =>
                    t.role === "user" ? (
                      <UserBubble key={t.id} text={t.text} />
                    ) : (
                      <EndUserCard key={t.id} output={t.output} />
                    ),
                  )}
                  {/* In-flight agent turn — same key as its eventual archived
                      turn, so it morphs loading→verdict in place (SID-59). */}
                  {pendingAgentId && !diagnose.isError && (
                    <EndUserCard
                      key={pendingAgentId}
                      output={diagnose.data ?? null}
                    />
                  )}
                  {pendingAgentId && diagnose.isError && (
                    <ErrorState
                      message={diagnose.error.message}
                      onRetry={() => runDiagnose(submitted, pendingAgentId)}
                    />
                  )}
                  <div ref={bottomRef} />
                </div>
              ) : (
                // WHAT → WHY → HOW, bottom-anchored just above the input.
                <div className="mt-auto flex flex-col gap-md pb-md">
                  <DisclosureBanner />
                  <p className="text-text-secondary">{GUIDANCE}</p>
                  <ScenarioChips
                    onPick={handlePickChip}
                    disabled={diagnose.isPending}
                  />
                </div>
              )}
            </div>

            {/* Pinned input area (bottom). */}
            <div className="flex flex-col gap-sm px-md pb-lg pt-md">
              {active && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="self-start text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  + New request
                </button>
              )}
              <DiagnosisInput
                value={symptom}
                onChange={setSymptom}
                onSubmit={() => handleSubmit(symptom)}
                disabled={diagnose.isPending}
              />
            </div>
          </div>
        </div>
      ) : !diagnose.isPending && !diagnose.isError && !diagnose.data ? (
        // ADMIN, empty — review-only (unchanged; SID-63 turns this into a feed).
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm px-lg text-center">
          <SearchIcon className="h-8 w-8 text-text-muted" />
          <p className="max-w-[420px] text-text-secondary">
            Submit a request from the End user view — the escalation package will
            appear here.
          </p>
        </div>
      ) : isAmbiguityRefuse && data ? (
        // ADMIN, ambiguity refuse — compact note, no trace (SID-56 Phase 2 A).
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-lg">
          <div className="w-full max-w-[520px] motion-safe:animate-[fadeIn_250ms_ease-out]">
            <RefusalOutput output={data} />
          </div>
        </div>
      ) : (
        // ADMIN, active — two-pane escalation package (unchanged).
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
              <div className="flex flex-col gap-md motion-safe:animate-[fadeIn_250ms_ease-out]">
                <p className="text-sm text-text-muted">
                  Escalation package — the full investigation an admin receives.
                </p>
                {diagnose.data.verdict === "refuse_out_of_scope" ? (
                  <RefusalOutput output={diagnose.data} />
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

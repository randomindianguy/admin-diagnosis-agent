"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DiagnosisInput } from "@/components/diagnosis-input";
import { EndUserCard } from "@/components/end-user-card";
import { UserBubble } from "@/components/user-bubble";
import { ErrorState } from "@/components/error-state";
import { TicketFeed } from "@/components/ticket-feed";
import { TicketDetail, type LiveTrace } from "@/components/ticket-detail";
import { PersonaToggle, type PersonaView } from "@/components/persona-toggle";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { GitHubIcon } from "@/components/icons";
import { useDiagnose } from "@/hooks/use-diagnose";
import { useTraceReveal } from "@/hooks/use-trace-reveal";
import { useSubmissions, makeId, type Turn, type Requester } from "@/lib/store";
import { PERSONAS } from "@/lib/seed-submissions";

const REPO_URL = "https://github.com/randomindianguy/admin-diagnosis-agent";

// Admin reasoning trace = 7 steps (Scope check leads). Reveal mounts rows over
// ~3.5s; on resolve the values swap in (staggered); the card un-gates when the
// trace signals it's settled (SID-50).
const TOTAL_TRACE_ROWS = 7;

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
          className="inline-flex min-h-[44px] items-center rounded-md border border-border px-md py-xs text-sm text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary disabled:opacity-50"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [symptom, setSymptom] = useState("");
  // The query that produced the current result (kept for the live retry path).
  const [submitted, setSubmitted] = useState("");
  const [personaView, setPersonaView] = useState<PersonaView>("end-user");
  // End-user portal (SID-68): which persona is "me", and which past ticket of
  // theirs is open (read-only). Local UI state — the store + admin stay untouched.
  const [currentPersona, setCurrentPersona] = useState<Requester>(PERSONAS[0]);
  const [pastSelectedId, setPastSelectedId] = useState<string | null>(null);
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

  // Shared submissions store. End-user drives the ACTIVE conversation; the admin
  // feed reads the full list + a selected ticket (SID-63).
  const submissions = useSubmissions((s) => s.submissions);
  const activeId = useSubmissions((s) => s.activeId);
  const selectedId = useSubmissions((s) => s.selectedId);
  const startSubmission = useSubmissions((s) => s.startSubmission);
  const addUserTurn = useSubmissions((s) => s.addUserTurn);
  const addAgentTurn = useSubmissions((s) => s.addAgentTurn);
  const resetStore = useSubmissions((s) => s.reset);
  const seed = useSubmissions((s) => s.seed);
  const selectTicket = useSubmissions((s) => s.selectTicket);
  const markAllSeen = useSubmissions((s) => s.markAllSeen);

  const active = submissions.find((s) => s.id === activeId) ?? null;
  const turns = active?.turns ?? [];

  // End-user portal (SID-68): this persona's own tickets for the left rail, the
  // open past ticket, and whether a detail/active view is showing (mobile drill-in).
  const personaSubs = submissions.filter(
    (s) => s.requester.name === currentPersona.name,
  );
  const pastSub = submissions.find((s) => s.id === pastSelectedId) ?? null;
  const mobileDetailOpen = !!active || !!pastSub;
  // SID-69: minutes between the original request and its continuation, for the
  // "— N min later" divider in a past ticket's read-only thread.
  const pastGapMin =
    pastSub?.follow_up_turns?.[0]?.at != null
      ? Math.round((pastSub.follow_up_turns[0].at - pastSub.createdAt) / 60_000)
      : null;

  // `now` anchors the "X ago" timestamps. Computed once via a lazy initializer
  // (not setState-in-effect); only ever read once the admin feed renders, which
  // is client-only (personaView defaults to end-user), so no SSR time mismatch.
  const [now] = useState(() => Date.now());
  // Pre-seed the demo tickets once on mount (zustand action, guarded internally).
  useEffect(() => {
    seed();
  }, [seed]);

  const unseenCount = submissions.filter((s) => !s.seen).length;
  const selectedSub = submissions.find((s) => s.id === selectedId) ?? null;
  // The selected ticket is "live" only while it's the active conversation still
  // being diagnosed — then the trace animates (SID-59) and the package gates.
  const selectedIsLive =
    !!selectedSub && selectedSub.id === activeId && pendingAgentId !== null;

  // Switching to Admin clears the unseen indicator.
  const handlePersonaChange = (next: PersonaView) => {
    setPersonaView(next);
    if (next === "admin") markAllSeen();
  };

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
      // SID-70: reason against the active persona's real Okta identity.
      diagnose.mutate(
        { symptom: query, personaUserId: currentPersona.userId },
        {
          onSuccess: (output) => {
            addAgentTurn(output, agentId);
            setPendingAgentId(null);
            setResolveKey((k) => k + 1);
          },
        },
      );
    },
    [diagnose, addAgentTurn, currentPersona.userId],
  );

  // Live trace state for the in-flight selected ticket (after runDiagnose so the
  // retry closure can reference it).
  const live: LiveTrace | undefined = selectedIsLive
    ? {
        output: diagnose.data ?? null,
        isError: diagnose.isError,
        errorMessage: diagnose.error?.message,
        onRetry: () => runDiagnose(submitted, pendingAgentId!),
        revealedRowCount,
        swappedRowCount,
        onSettled: handleSettled,
        packageReady: traceSettled,
      }
    : undefined;

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

    if (!active) startSubmission(currentPersona, q);
    else addUserTurn(q);

    const agentId = makeId("agent");
    setPastSelectedId(null); // leaving any past view → this becomes the active one
    setPendingAgentId(agentId);
    setSubmitted(query);
    setSymptom(""); // clear input on submit (standard chat behavior)
    runDiagnose(query, agentId);
  }

  // Reset to the compose state. The submission persists in the store's feed (the
  // live-ingestion seam SID-63 reads, and the SID-68 rail's "Recent") — only the
  // active + past pointers clear. Doubles as the rail "New request" and mobile back.
  function handleReset() {
    resetStore();
    diagnose.reset();
    setPendingAgentId(null);
    setPastSelectedId(null);
    setSymptom("");
    setSubmitted("");
    setTraceSettled(false);
  }

  // Chip click doubles as "start over from here": reset, then pre-fill.
  function handlePickChip(query: string) {
    handleReset();
    setSymptom(query);
  }

  // SID-68: switch the logged-in persona — swaps the rail and clears the right
  // pane to compose (a fresh session as that person).
  function handleSelectPersona(p: Requester) {
    setCurrentPersona(p);
    handleReset();
  }

  // SID-68: open one of this persona's past tickets, read-only. Leaves any active
  // conversation (it persists in the feed) and shows the selected ticket.
  function handleSelectPast(id: string) {
    resetStore();
    diagnose.reset();
    setPendingAgentId(null);
    setTraceSettled(false);
    setPastSelectedId(id);
  }

  return (
    <main className="flex h-screen w-full flex-col bg-background-primary text-text-primary">
      {/* Shared top bar — the persona toggle is the structural shell switch. */}
      <header className="flex items-center justify-between border-b border-border px-lg py-md">
        {/* SID-67 wordmark — type-only, the mark IS the type. Display serif
            (Newsreader), no shield glyph. Page h1 (SID-64 a11y) preserved. */}
        <h1 className="font-display text-[22px] font-medium tracking-display text-text-primary">
          Cleared
        </h1>
        <div className="flex items-center gap-md">
          <PersonaToggle
            value={personaView}
            onChange={handlePersonaChange}
            unseenCount={unseenCount}
          />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex h-[44px] w-[44px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </div>
      </header>

      {personaView === "end-user" ? (
        // END-USER — personal help portal (SID-68): persona-aware history (left
        // rail) + a right pane that is compose / past-ticket (read-only) / active
        // conversation. ChatGPT-style two-pane on desktop; single-pane stacked on
        // mobile with drill-in to a past ticket.
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* LEFT RAIL — persona switcher, "New request", this persona's Recent.
              Hidden on mobile while a detail/active view is open (drill-in). */}
          <aside
            className={`min-h-0 shrink-0 flex-col border-border md:flex md:max-h-none md:w-[320px] md:border-b-0 md:border-r ${
              mobileDetailOpen ? "hidden md:flex" : "flex max-h-[50vh] border-b"
            }`}
          >
            <div className="shrink-0 border-b border-border p-sm">
              <PersonaSwitcher
                personas={PERSONAS}
                current={currentPersona}
                onSelect={handleSelectPersona}
              />
              <button
                type="button"
                onClick={handleReset}
                className="mt-xs inline-flex min-h-[40px] w-full items-center rounded-md px-sm text-sm text-text-secondary transition-colors hover:bg-background-secondary hover:text-text-primary"
              >
                + New request
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-md">
              <p className="mb-sm font-display text-displaySm italic lowercase text-text-muted">
                recent
              </p>
              {personaSubs.length > 0 ? (
                <TicketFeed
                  submissions={personaSubs}
                  selectedId={pastSelectedId}
                  now={now}
                  onSelect={handleSelectPast}
                  final
                />
              ) : (
                <p className="text-sm text-text-muted">No recent tickets.</p>
              )}
            </div>
          </aside>

          {/* RIGHT PANE — compose / past ticket / active conversation. */}
          <section className="flex min-w-0 flex-1 flex-col">

            {/* Mobile drill-out — only when a detail/active view is open. */}
            {mobileDetailOpen && (
              <button
                type="button"
                onClick={handleReset}
                className="flex min-h-[44px] shrink-0 items-center gap-xs border-b border-border px-md text-sm text-text-secondary transition-colors hover:text-text-primary md:hidden"
              >
                ← Back
              </button>
            )}

            <div className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col">
              {active ? (
                // ACTIVE CONVERSATION — the live stream + input (multi-turn).
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-auto px-md pt-lg">
                    <div
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                      className="flex flex-col gap-md"
                    >
                      {turns.map((t) =>
                        t.role === "user" ? (
                          <UserBubble key={t.id} text={t.text} />
                        ) : (
                          <EndUserCard
                            key={t.id}
                            output={t.output}
                            status={active?.status}
                          />
                        ),
                      )}
                      {pendingAgentId && !diagnose.isError && (
                        <EndUserCard
                          key={pendingAgentId}
                          output={diagnose.data ?? null}
                          status={active?.status}
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
                  </div>
                  <div className="px-md pb-lg pt-md">
                    <DiagnosisInput
                      value={symptom}
                      onChange={setSymptom}
                      onSubmit={() => handleSubmit(symptom)}
                      disabled={diagnose.isPending}
                    />
                  </div>
                </>
              ) : pastSub ? (
                // PAST TICKET — read-only conversation (no input). SID-69: a
                // continuation (clarify → resolve) renders below a muted
                // "— N min later" divider so the two moments read as a real thread.
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-md py-lg">
                  <div className="flex flex-col gap-md">
                    {pastSub.turns.map((t) =>
                      t.role === "user" ? (
                        <UserBubble key={t.id} text={t.text} />
                      ) : (
                        <EndUserCard
                          key={t.id}
                          output={t.output}
                          status={pastSub.status}
                        />
                      ),
                    )}
                    {pastSub.follow_up_turns &&
                      pastSub.follow_up_turns.length > 0 && (
                        <>
                          <div className="my-xs flex items-center gap-sm" aria-hidden>
                            <span className="h-px flex-1 bg-border" />
                            <span className="font-mono text-[11px] text-text-muted">
                              {pastGapMin} min later
                            </span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                          {pastSub.follow_up_turns.map((t) =>
                            t.role === "user" ? (
                              <UserBubble key={t.id} text={t.text} />
                            ) : (
                              <EndUserCard
                          key={t.id}
                          output={t.output}
                          status={pastSub.status}
                        />
                            ),
                          )}
                        </>
                      )}
                  </div>
                </div>
              ) : (
                // COMPOSE — empty state. "What's blocked?" + chips + input.
                <>
                  <div className="flex min-h-0 flex-1 flex-col justify-end overflow-auto px-md pt-lg">
                    <div className="flex flex-col gap-md pb-md">
                      <div className="flex flex-col gap-xs">
                        <h2 className="font-display text-[28px] font-medium leading-heading tracking-display text-text-primary">
                          What&rsquo;s blocked?
                        </h2>
                        <p className="font-display text-[15px] italic text-text-muted">
                          Describe what you can&rsquo;t reach — I&rsquo;ll check
                          your access and answer, or ask one question before
                          guessing.
                        </p>
                      </div>
                      <ScenarioChips
                        onPick={handlePickChip}
                        disabled={diagnose.isPending}
                      />
                    </div>
                  </div>
                  <div className="px-md pb-lg pt-md">
                    <DiagnosisInput
                      value={symptom}
                      onChange={setSymptom}
                      onSubmit={() => handleSubmit(symptom)}
                      disabled={diagnose.isPending}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        // ADMIN — ticket system (SID-63): feed (list) + selected ticket (detail),
        // both reading the shared store. This replaces the diagnose.data-coupled
        // view (which desynced on reset). Responsive: stacked on mobile, side-by-
        // side on md+.
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="max-h-[40vh] shrink-0 overflow-auto border-b border-border p-md md:max-h-none md:w-[340px] md:border-b-0 md:border-r">
            <TicketFeed
              submissions={submissions}
              selectedId={selectedId}
              now={now}
              onSelect={selectTicket}
            />
          </aside>
          <section className="min-w-0 flex-1 overflow-auto p-lg">
            {selectedSub ? (
              <TicketDetail
                key={selectedSub.id}
                submission={selectedSub}
                now={now}
                live={live}
              />
            ) : (
              <p className="text-text-secondary">Select a ticket to view it.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
